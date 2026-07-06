/**
 * PtyRouter — the Durable Object that relays between one local bridge socket and
 * many browser client sockets, cross-routing JSON frames by sessionId.
 *
 * Design decisions baked in from two historical bugs:
 *  - newest-wins replacement caused an eviction loop when two backends each ran
 *    a bridge. Fix: REJECT a newcomer when a healthy bridge already holds the
 *    slot (attachBridge below).
 *  - the DO is a singleton (idFromName('default')); see sharp-edges.md for the
 *    host-partitioning story if you need to scale to multiple machines.
 *
 * The DO never inspects payloads beyond `sessionId`.
 */

interface BridgeHolder {
  host: string;
  pid: number;
  startedAt: string;
}

interface Env {
  // bindings injected by wrangler; not used directly inside the DO here.
  [key: string]: unknown;
}

export class PtyRouter {
  private bridge: WebSocket | null = null;
  private bridgeHolder: BridgeHolder | null = null;
  private clients = new Map<string, WebSocket>(); // sessionId -> client socket
  private liveSessions = new Set<string>(); // sessions that have seen a bridge

  // diagnostics
  private bridgeConflicts = 0;
  private lastConflict: { at: string; holder: BridgeHolder | null } | null = null;
  private lastDisconnect: { at: string; host: string; code: number } | null = null;
  private bridgePing?: ReturnType<typeof setInterval>;

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');

    // /status (root) — the source of truth for the cloud.
    if (url.pathname === '/' && request.headers.get('Upgrade') !== 'websocket') {
      return this.statusResponse();
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    if (role === 'bridge') {
      this.attachBridge(server);
    } else {
      const sessionId = url.searchParams.get('sessionId') || '';
      this.attachClient(server, sessionId);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // --- bridge side ----------------------------------------------------------
  private attachBridge(ws: WebSocket): void {
    // Wait for hello before deciding accept/reject.
    ws.addEventListener('message', (ev) => {
      const frame = safeParse(ev.data);
      if (!frame) return;

      if (frame.t === 'hello') {
        const incoming: BridgeHolder = {
          host: frame.host,
          pid: frame.pid,
          startedAt: frame.startedAt,
        };
        if (this.bridge && this.isBridgeHealthy()) {
          // REJECT newcomer — the eviction-loop fix.
          this.bridgeConflicts += 1;
          this.lastConflict = { at: new Date().toISOString(), holder: this.bridgeHolder };
          ws.send(
            JSON.stringify({
              t: 'rejected',
              reason: 'another bridge already attached',
              holder: this.bridgeHolder,
              retryAfterMs: 60_000,
            }),
          );
          ws.close(4001, 'another bridge already attached');
          return;
        }
        // Claim the slot.
        this.bridge = ws;
        this.bridgeHolder = incoming;
        ws.send(
          JSON.stringify({
            t: 'bridge-ack',
            at: new Date().toISOString(),
            previousDisconnect: this.lastDisconnect ?? undefined,
          }),
        );
        this.startBridgePing();
        return;
      }

      if (frame.t === 'pong' || frame.t === 'ping') {
        if (frame.t === 'ping') ws.send(JSON.stringify({ t: 'pong', ts: frame.ts }));
        return;
      }

      // Any other frame from the bridge is per-session output -> route to client.
      if (frame.sessionId) {
        this.liveSessions.add(frame.sessionId);
        const client = this.clients.get(frame.sessionId);
        client?.send(typeof ev.data === 'string' ? ev.data : JSON.stringify(frame));
      }
    });

    ws.addEventListener('close', (ev) => {
      if (ws !== this.bridge) return; // a rejected newcomer closing — ignore
      this.lastDisconnect = {
        at: new Date().toISOString(),
        host: this.bridgeHolder?.host ?? 'unknown',
        code: ev.code,
      };
      this.bridge = null;
      this.bridgeHolder = null;
      this.stopBridgePing();
      // Tell every live client the bridge dropped (so the UI shows a clear error).
      for (const [sessionId, client] of this.clients) {
        if (this.liveSessions.has(sessionId)) {
          client.send(
            JSON.stringify({
              t: 'bridge-down',
              sessionId,
              reason: 'bridge disconnected',
              code: ev.code,
              host: this.lastDisconnect.host,
            }),
          );
        }
      }
    });
  }

  // --- client side ----------------------------------------------------------
  private attachClient(ws: WebSocket, sessionId: string): void {
    if (sessionId) this.clients.set(sessionId, ws);

    ws.addEventListener('message', (ev) => {
      const frame = safeParse(ev.data);
      if (!frame) return;
      const sid = frame.sessionId || sessionId;
      if (sid) this.clients.set(sid, ws);

      if (!this.bridge) {
        // No bridge attached — synthesize a clear failure for spawn/attach.
        if (frame.t === 'spawn' || frame.t === 'attach') {
          ws.send(
            JSON.stringify({
              t: frame.t === 'spawn' ? 'spawned' : 'attached',
              sessionId: sid,
              ok: false,
              error: this.noBridgeExplanation(),
              diag: {
                lastDisconnect: this.lastDisconnect,
                conflicts: this.bridgeConflicts,
                lastConflict: this.lastConflict,
              },
            }),
          );
        }
        return;
      }
      // Forward to the bridge verbatim.
      this.bridge.send(typeof ev.data === 'string' ? ev.data : JSON.stringify(frame));
    });

    ws.addEventListener('close', () => {
      for (const [sid, c] of this.clients) if (c === ws) this.clients.delete(sid);
    });
  }

  // --- keepalive / health ---------------------------------------------------
  private startBridgePing(): void {
    this.stopBridgePing();
    this.bridgePing = setInterval(() => {
      try {
        this.bridge?.send(JSON.stringify({ t: 'ping', ts: Date.now() }));
      } catch {
        /* socket closing */
      }
    }, 25_000);
  }
  private stopBridgePing(): void {
    if (this.bridgePing) clearInterval(this.bridgePing);
    this.bridgePing = undefined;
  }
  private isBridgeHealthy(): boolean {
    return !!this.bridge && this.bridge.readyState === WebSocket.READY_STATE_OPEN;
  }

  private noBridgeExplanation(): string {
    if (this.lastDisconnect) {
      return `No local bridge is connected. Last bridge (${this.lastDisconnect.host}) disconnected at ${this.lastDisconnect.at} (code ${this.lastDisconnect.code}). Start the bridge daemon on the host machine.`;
    }
    return 'No local bridge has ever connected. Start the bridge daemon on the host machine and confirm DASHBOARD_AGENT_SECRET matches the worker AGENT_SECRET.';
  }

  private statusResponse(): Response {
    return Response.json({
      bridgeConnected: this.isBridgeHealthy(),
      bridgeHolder: this.bridgeHolder,
      bridgeConflicts: this.bridgeConflicts,
      lastConflict: this.lastConflict,
      lastDisconnect: this.lastDisconnect,
      clientCount: this.clients.size,
      liveSessions: this.liveSessions.size,
    });
  }
}

// Cloudflare's WebSocket exposes a numeric readyState; provide the constant.
declare global {
  interface WebSocket {
    readonly READY_STATE_OPEN?: number;
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(WebSocket as any).READY_STATE_OPEN = 1;

function safeParse(data: unknown): any | null {
  try {
    return JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer));
  } catch {
    return null;
  }
}

// Minimal ambient types so this file is self-contained without @cloudflare/workers-types.
interface DurableObjectState {
  // intentionally minimal
  [key: string]: unknown;
}
declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}
