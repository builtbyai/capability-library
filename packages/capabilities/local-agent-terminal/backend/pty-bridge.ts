/**
 * pty-bridge — the local machine's outbound WebSocket to the Cloudflare worker.
 *
 * It holds the worker's single bridge slot and multiplexes every browser session
 * over that one socket, keyed by sessionId. It speaks the bridge<->DO handshake
 * (hello / bridge-ack / rejected / ping-pong) and translates per-session frames
 * to and from pty-service.
 *
 * Hard rules encoded here:
 *  - 401 from the worker is SEVERE and does NOT silent-retry (bad secret).
 *  - A `rejected` (another bridge holds the slot) backs off >= 60s, never hammers.
 *  - When the worker WS drops, PTYs are kept alive (onDown does not kill sessions).
 */
import os from 'node:os';
import WebSocket from 'ws';
import { createLogger, secrets, requireSecret, EnvFileSecretProvider } from '@multimarcdown/core';
import {
  parseFrame,
  type AnyFrame,
  type HostToClient,
} from '../contracts/protocol.js';
import {
  createPtySession,
  attachListener,
  detachListener,
  writePty,
  resizePty,
  closePtySession,
  sessionExists,
  type SessionInfo,
} from './pty-service.js';

const log = createLogger('pty-bridge');
const VERSION = '0.1.0';
const HELLO_MUST_WITHIN_MS = 5000;
const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 15_000;
const RECONNECT_MS = 3_000;
const REJECT_BACKOFF_MS = 60_000;

export type BridgeStatus =
  | 'idle'
  | 'connecting'
  | 'claimed'
  | 'rejected'
  | 'no-secret'
  | 'down';

interface BridgeState {
  status: BridgeStatus;
  wsReadyState: number;
  host: string;
  pid: number;
  startedAt: string;
  lastDisconnect?: { at: string; code: number; reason: string };
  lastConflict?: { at: string; holder?: unknown };
  conflicts: number;
}

interface SessionLink {
  serviceSessionId: string;
  /** Virtual listener handed to pty-service; rewrites sessionId on the way out. */
  virtualWs: VirtualListener;
}

const state: BridgeState = {
  status: 'idle',
  wsReadyState: WebSocket.CLOSED,
  host: os.hostname(),
  pid: process.pid,
  startedAt: new Date().toISOString(),
  conflicts: 0,
};

let ws: WebSocket | undefined;
let helloTimer: NodeJS.Timeout | undefined;
let pingTimer: NodeJS.Timeout | undefined;
let pongTimer: NodeJS.Timeout | undefined;
let reconnectTimer: NodeJS.Timeout | undefined;
let stopped = false;
const links = new Map<string, SessionLink>(); // browserSessionId -> link

export interface StartOptions {
  cloudWsBase: string; // wss://<worker>.workers.dev
  agentSecretFile?: string; // fallback file path
}

export function startPtyBridge(opts: StartOptions): void {
  stopped = false;
  let token: string;
  try {
    token = requireSecret(
      opts.agentSecretFile
        ? secretsWithFile(opts.agentSecretFile)
        : secrets,
      'DASHBOARD_AGENT_SECRET',
      'the bridge cannot authenticate to the worker without it',
    );
  } catch (err) {
    state.status = 'no-secret';
    log.severe('no agent secret — set DASHBOARD_AGENT_SECRET or write the secret file', {
      err: String(err),
    });
    return;
  }
  connect(opts.cloudWsBase, token);
}

export function stopPtyBridge(): void {
  stopped = true;
  clearTimers();
  ws?.close();
  ws = undefined;
  state.status = 'idle';
}

export function getBridgeStatus(): BridgeState {
  return { ...state, wsReadyState: ws?.readyState ?? WebSocket.CLOSED };
}

// --- connection lifecycle ---------------------------------------------------
function connect(base: string, token: string): void {
  if (stopped) return;
  const url = `${base.replace(/\/$/, '')}/v1/pty/bridge?token=${encodeURIComponent(token)}`;
  state.status = 'connecting';
  log.info('connecting to worker', { host: state.host });

  ws = new WebSocket(url);

  ws.on('unexpected-response', (_req, res) => {
    if (res.statusCode === 401) {
      // Do NOT silent-retry on auth failure.
      state.status = 'rejected';
      log.severe('handshake rejected by worker — HTTP 401 (bad AGENT_SECRET)');
      stopped = true;
    }
  });

  ws.on('open', () => {
    log.info('socket open; sending hello');
    sendHello();
    // The DO must bridge-ack within HELLO_MUST_WITHIN_MS or we treat it as failed.
    helloTimer = setTimeout(() => {
      log.warn('no bridge-ack within window; closing to retry');
      ws?.close();
    }, HELLO_MUST_WITHIN_MS);
  });

  ws.on('message', (raw) => onWorkerMessage(raw.toString(), base, token));

  ws.on('close', (code, reasonBuf) => {
    const reason = reasonBuf.toString();
    state.lastDisconnect = { at: new Date().toISOString(), code, reason };
    state.status = 'down';
    clearTimers();
    // PTYs are deliberately kept alive across worker drops.
    if (code === 4001) {
      state.conflicts += 1;
      state.lastConflict = { at: new Date().toISOString() };
      log.warn('another bridge already attached; backing off', { backoffMs: REJECT_BACKOFF_MS });
      scheduleReconnect(base, token, REJECT_BACKOFF_MS);
    } else if (!stopped) {
      scheduleReconnect(base, token, RECONNECT_MS);
    }
  });

  ws.on('error', (err) => log.warn('socket error', { err: String(err) }));
  ws.on('pong', () => {
    if (pongTimer) clearTimeout(pongTimer);
  });
}

function onWorkerMessage(raw: string, base: string, token: string): void {
  const frame = parseFrame(raw);
  if (!frame) return;

  switch (frame.t) {
    case 'bridge-ack':
      if (helloTimer) clearTimeout(helloTimer);
      state.status = 'claimed';
      log.info('bridge slot claimed');
      startKeepalive();
      return;
    case 'rejected':
      state.conflicts += 1;
      state.lastConflict = { at: new Date().toISOString(), holder: frame.holder };
      state.status = 'rejected';
      log.warn('rejected by DO (slot held)', { holder: frame.holder });
      ws?.close();
      scheduleReconnect(base, token, Math.max(frame.retryAfterMs ?? 0, REJECT_BACKOFF_MS));
      return;
    case 'ping':
      sendJson({ t: 'pong', ts: frame.ts });
      return;
    default:
      // Per-session client frame routed from a browser via the DO.
      handleClientFrame(frame);
  }
}

// --- per-session multiplexing ----------------------------------------------
function handleClientFrame(frame: AnyFrame): void {
  if (!('sessionId' in frame) || typeof frame.sessionId !== 'string') return;
  const browserSessionId = frame.sessionId;

  switch (frame.t) {
    case 'spawn': {
      try {
        const info: SessionInfo = createPtySession({
          cols: frame.cols,
          rows: frame.rows,
          cwd: frame.cwd,
          shell: frame.shell,
        });
        const virtualWs = new VirtualListener(browserSessionId, info.sessionId, sendToClient);
        attachListener(info.sessionId, virtualWs as unknown as WebSocket);
        links.set(browserSessionId, { serviceSessionId: info.sessionId, virtualWs });
        sendToClient({
          t: 'spawned',
          sessionId: browserSessionId,
          ok: true,
          cols: info.cols,
          rows: info.rows,
          shell: info.shell,
        });
      } catch (err) {
        sendToClient({
          t: 'spawned',
          sessionId: browserSessionId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }
    case 'attach': {
      const link = links.get(browserSessionId);
      if (link && sessionExists(link.serviceSessionId)) {
        attachListener(link.serviceSessionId, link.virtualWs as unknown as WebSocket);
        sendToClient({ t: 'attached', sessionId: browserSessionId, ok: true });
      } else {
        sendToClient({ t: 'attached', sessionId: browserSessionId, ok: false, error: 'no live session' });
      }
      return;
    }
    case 'data': {
      const link = links.get(browserSessionId);
      if (link) writePty(link.serviceSessionId, frame.d);
      return;
    }
    case 'resize': {
      const link = links.get(browserSessionId);
      if (link) resizePty(link.serviceSessionId, frame.cols, frame.rows);
      return;
    }
    case 'kill': {
      const link = links.get(browserSessionId);
      if (link) closePtySession(link.serviceSessionId);
      links.delete(browserSessionId);
      return;
    }
    case 'close': {
      // Client gone but keep PTY alive — just detach the virtual listener.
      const link = links.get(browserSessionId);
      if (link) detachListener(link.serviceSessionId, link.virtualWs as unknown as WebSocket);
      return;
    }
  }
}

/** Forward a host->client frame to the worker (which routes it to the browser). */
function sendToClient(frame: HostToClient): void {
  sendJson(frame);
}

// --- keepalive --------------------------------------------------------------
function startKeepalive(): void {
  clearInterval(pingTimer as NodeJS.Timeout);
  pingTimer = setInterval(() => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.ping();
    sendJson({ t: 'ping', ts: Date.now() });
    pongTimer = setTimeout(() => {
      log.warn('pong timeout; terminating socket');
      ws?.terminate();
    }, PONG_TIMEOUT_MS);
  }, PING_INTERVAL_MS);
}

// --- helpers ----------------------------------------------------------------
function sendHello(): void {
  sendJson({
    t: 'hello',
    host: state.host,
    pid: state.pid,
    version: VERSION,
    startedAt: state.startedAt,
  });
}

function sendJson(obj: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (err) {
      log.warn('send failed', { err: String(err) });
    }
  }
}

function scheduleReconnect(base: string, token: string, delayMs: number): void {
  if (stopped) return;
  clearTimeout(reconnectTimer as NodeJS.Timeout);
  reconnectTimer = setTimeout(() => connect(base, token), delayMs);
}

function clearTimers(): void {
  for (const t of [helloTimer, pingTimer, pongTimer, reconnectTimer]) if (t) clearTimeout(t as NodeJS.Timeout);
  if (pingTimer) clearInterval(pingTimer);
  helloTimer = pingTimer = pongTimer = reconnectTimer = undefined;
}

function secretsWithFile(file: string) {
  // Build a one-off provider that adds the file fallback for AGENT_SECRET.
  return new EnvFileSecretProvider({ fileFallbacks: { DASHBOARD_AGENT_SECRET: file } });
}

/**
 * A minimal object that quacks enough like a ws.WebSocket for pty-service's
 * fan-out (readyState/OPEN/send). On send it rewrites the service sessionId to
 * the browser sessionId and forwards over the real bridge socket.
 */
class VirtualListener {
  readonly OPEN = WebSocket.OPEN;
  readyState = WebSocket.OPEN;
  constructor(
    private browserSessionId: string,
    private serviceSessionId: string,
    private forward: (frame: HostToClient) => void,
  ) {}
  send(data: string): void {
    const frame = parseFrame(data);
    if (frame && 'sessionId' in frame) {
      (frame as { sessionId: string }).sessionId = this.browserSessionId;
      this.forward(frame as HostToClient);
    }
  }
}
