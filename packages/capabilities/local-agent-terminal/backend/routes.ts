/**
 * Backend wiring for direct mode (LAN/localhost) plus the bridge boot gating.
 *
 * Drop `registerPtyRoutes(server)` into your dashboard backend after the HTTP
 * server is created. It mounts:
 *   POST /api/pty/create        -> spawn a PTY, return { sessionId, cols, rows, shell }
 *   POST /api/pty/attach        -> check a stored session is still alive
 *   POST /api/pty/close         -> close a PTY
 *   GET  /api/pty/bridge-status -> inline bridge status (cloud relay)
 *   WS   /ws/terminal/:id       -> attach an xterm socket to a live PTY
 *
 * Then call `bootBridge()` AFTER server.listen — but only on the instance that
 * wins the preferred port (so two auto-port-fallthrough backends don't fight).
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { createLogger } from '@multimarcdown/core';
import {
  createPtySession,
  attachListener,
  detachListener,
  writePty,
  resizePty,
  closePtySession,
  sessionExists,
  getSessionInfo,
  configureService,
} from './pty-service.js';
import { startPtyBridge, getBridgeStatus } from './pty-bridge.js';
import { parseFrame, CLOSE_CODES } from '../contracts/protocol.js';

const log = createLogger('pty-routes');

export interface RouteOptions {
  cloudWsBase: string;
  preferredPort: number;
  chosenPort: number;
  daemonStatusPort?: number;
  idleReaperMs?: number;
}

/** Mount HTTP + WS routes onto an existing Node http server. */
export function registerPtyRoutes(server: http.Server, opts: RouteOptions): void {
  configureService({ idleReaperMs: opts.idleReaperMs });

  // HTTP routes. Integrate with whatever router you use; shown raw for portability.
  const httpListeners = server.listeners('request');
  // Prepend our handler so it can shortcut /api/pty/* before your app router.
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    if (req.url && req.method === 'POST' && req.url.startsWith('/api/pty/')) {
      return handlePtyHttp(req, res, opts);
    }
    if (req.url === '/api/pty/bridge-status' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(getBridgeStatus()));
      return;
    }
    for (const l of httpListeners) (l as (...a: unknown[]) => void)(req, res);
  });

  // WS upgrade for direct mode.
  const ptyWss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const m = req.url?.match(/^\/ws\/terminal\/([^/?#]+)/);
    if (!m) return; // let other ws routes handle it (don't destroy unconditionally)
    const sessionId = m[1]!;
    ptyWss.handleUpgrade(req, socket, head, (ws) => {
      if (!attachListener(sessionId, ws)) {
        ws.send(JSON.stringify({ t: 'error', message: 'Unknown session' }));
        ws.close(CLOSE_CODES.NO_SESSION, 'no session');
        return;
      }
      ws.on('message', (raw) => {
        const msg = parseFrame(raw.toString());
        if (!msg) return;
        if (msg.t === 'data' && 'd' in msg && typeof msg.d === 'string') writePty(sessionId, msg.d);
        else if (msg.t === 'resize' && 'cols' in msg && 'rows' in msg) resizePty(sessionId, msg.cols, msg.rows);
      });
      ws.on('close', () => detachListener(sessionId, ws));
      ws.on('error', () => detachListener(sessionId, ws));
    });
  });

  log.info('pty routes registered');
}

async function handlePtyHttp(req: http.IncomingMessage, res: http.ServerResponse, _opts: RouteOptions): Promise<void> {
  const body = await readJson(req);
  const send = (code: number, obj: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  switch (req.url) {
    case '/api/pty/create': {
      const info = createPtySession(body ?? {});
      return send(200, info);
    }
    case '/api/pty/attach': {
      const id = body?.sessionId as string | undefined;
      if (id && sessionExists(id)) return send(200, { ok: true, info: getSessionInfo(id) });
      return send(200, { ok: false });
    }
    case '/api/pty/close': {
      const id = body?.sessionId as string | undefined;
      if (id) closePtySession(id);
      return send(200, { ok: true });
    }
    default:
      return send(404, { error: 'not found' });
  }
}

/**
 * Boot the bridge AFTER server.listen — daemon-priority gating.
 * Only the instance that won the preferred port participates.
 */
export async function bootBridge(opts: RouteOptions): Promise<void> {
  if (opts.chosenPort !== opts.preferredPort) {
    log.info('not the preferred-port instance; assuming a sibling owns the bridge slot');
    return;
  }
  const daemonHealthy = await isPtyBridgeDaemonHealthy(opts.daemonStatusPort ?? 5181);
  if (daemonHealthy) {
    log.info('bridge daemon healthy — deferring; scheduling 60s takeover poll');
    scheduleInlineBridgeTakeover(opts);
  } else {
    log.info('no healthy daemon — starting inline bridge');
    startPtyBridge({ cloudWsBase: opts.cloudWsBase });
  }
}

/** Resolves true iff the daemon's /status reports an open worker socket. */
export async function isPtyBridgeDaemonHealthy(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return false;
    const j = (await r.json()) as { wsReadyState?: number };
    return j.wsReadyState === 1; // WebSocket.OPEN
  } catch {
    return false;
  }
}

let takeoverTimer: NodeJS.Timeout | undefined;
function scheduleInlineBridgeTakeover(opts: RouteOptions): void {
  if (takeoverTimer) return;
  takeoverTimer = setInterval(async () => {
    const healthy = await isPtyBridgeDaemonHealthy(opts.daemonStatusPort ?? 5181);
    if (!healthy) {
      log.warn('daemon went away — taking over with inline bridge');
      clearInterval(takeoverTimer!);
      takeoverTimer = undefined;
      startPtyBridge({ cloudWsBase: opts.cloudWsBase });
    }
  }, 60_000);
  takeoverTimer.unref?.();
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}
