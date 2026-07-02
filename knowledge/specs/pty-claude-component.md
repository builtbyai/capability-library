# PTY + Claude Code Terminal — Portable Component Guide

A complete description of how the embedded terminal works in Dashboard v5, including:

- Real pseudo-terminals via **node-pty** (ConPTY on Windows, forkpty on POSIX)
- **xterm.js** in the browser — full TUI support for Claude Code, vim, htop, btop
- **Cloud relay** through a Cloudflare Worker Durable Object so the cloud-hosted dashboard can open a shell on your local machine over the public internet
- **Persistence** — xterm + WebSocket survive React unmounts; session ID survives browser refresh; PTY survives WS hiccups
- **Claude Code launcher** — one-button "yolo" launch with `--dangerously-skip-permissions`, plus AI handoff: type a prompt into the dashboard's AI popup and it auto-spawns Claude inside the PTY and pipes the prompt in
- **AI shell-context** — the AI can read the active scrollback and propose commands as chips above the terminal that you accept with `Tab`

Everything you need to drop this into another dashboard is here, file-by-file.

---

## 1. Architecture — 3-hop relay

```
┌──────────────────────┐      ┌────────────────────────────┐      ┌────────────────────────┐
│  Browser             │      │  Cloudflare Worker         │      │  Local machine         │
│                      │      │  (dashboard-signaling)     │      │                        │
│  PtyTerminal.tsx     │      │                            │      │  pty-bridge.js         │
│   ├─ xterm.js        │ WSS  │  PtyRouter (Durable Object)│ WSS  │   └─ node-pty          │
│   └─ WebSocket  ◄────┼──────┼──► clients[sessionId] ◄────┼──────┼──► pty-service.js     │
│                      │      │      ▲                     │      │       └─ shell proc    │
│                      │      │      └─ bridge (singleton) │      │           (cmd, bash,  │
│                      │      │                            │      │            claude…)    │
└──────────────────────┘      └────────────────────────────┘      └────────────────────────┘
```

**Two operating modes**, picked automatically by `resolveBackendUrl()` in `PtyTerminal.tsx`:

| Mode | When | Wire |
|---|---|---|
| **direct** | Browser served from `localhost`, `127.0.0.1`, or a LAN IP over `http://` | Browser → `POST /api/pty/create` → `ws://backend:5001/ws/terminal/<sessionId>` |
| **cloud-relay** | Anything else (Pages site, mobile, off-LAN) — anything over `https://` | Browser → `wss://dashboard-signaling.<acct>.workers.dev/v1/pty/client?token=…&sessionId=…` → DO → outbound WS held by local `pty-bridge.js` → `pty-service.js` |

The **same `PtyTerminal.tsx` and the same xterm WebSocket** are used in both modes; only the URL and the auth differ. Cloud mode adds a `?token=<API_SECRET>` query param.

---

## 2. File inventory

Six core files + one Cloudflare Worker route + a `wrangler.toml` DO binding + an installer batch script.

### Frontend (React)

| Path | Role |
|---|---|
| `src/features/terminal/PtyTerminal.tsx` | The visible component. Owns xterm.js, the WebSocket, the cwd picker, the Claude launcher button, AI-proposal chips, and the handoff handler. |
| `src/features/terminal/PtyTerminal.css` | Styling — glassmorphism status bar, cwd chips, proposal chips, action buttons. Uses no CSS variables, fully self-contained. |
| `src/features/terminal/terminalStore.ts` | Module-level singleton that owns xterm + WS keyed by `slot`. Lets the React component unmount/remount without losing the shell. |
| `src/features/terminal/shellContext.ts` | Session registry + scrollback buffer + AI command-proposal queue. Bridges AI popup ↔ active PTY. |

### Backend (Node.js)

| Path | Role |
|---|---|
| `backend/pty-service.js` | Spawns / kills node-pty processes, fan-out to listener WebSockets, 30-min idle reaper. |
| `backend/pty-bridge.js` | Outbound WebSocket to the Cloudflare Worker. Multiplexes browser sessions over one bridge WS using `sessionId`. Handles hello/ack/rejection/keepalive. |
| `backend/pty-bridge-daemon.js` | Standalone process wrapper around `pty-bridge.js`. Survives backend restarts. Exposes a local `/status` diag. |
| Inline routes in `backend/app-launcher-backend.js` | `/api/pty/create`, `/api/pty/attach`, `/api/pty/close`, `/api/pty/bridge-status`, and the `/ws/terminal/<sessionId>` WS upgrade handler. |

### Cloudflare Worker

| Path | Role |
|---|---|
| `worker-signaling/src/pty-router.ts` | The `PtyRouter` Durable Object — the only place bridge + browser sockets coexist; cross-routes JSON frames by `sessionId`. |
| Inline `/v1/pty/*` routes in `worker-signaling/src/index.ts` | Auth check (`AGENT_SECRET` for bridge, `API_SECRET` for client), then `fetch()` into the DO. |
| `worker-signaling/wrangler.toml` | `PTY_ROUTER` DO binding + migration. |

### Install

| Path | Role |
|---|---|
| `install-pty-bridge.bat` | Drops a `.bat` into the Windows Startup folder so the daemon launches at every logon. |

### Dependencies

```json
// package.json — frontend
"@xterm/xterm": "^6.0.0",
"@xterm/addon-fit": "^0.11.0",
"@xterm/addon-web-links": "^0.12.0",

// package.json — backend
"node-pty": "^1.1.0",
"ws": "^8.x"
```

`node-pty` requires a native build. On Windows you need `node-gyp` toolchain (Visual Studio Build Tools). On Linux/macOS it's a `make` build.

---

## 3. Wire protocol

JSON over text WebSocket frames. The DO never inspects the payload — it routes by `sessionId`. The bridge daemon translates between this wire format and `pty.write()` / `pty.onData()`.

### Bridge ⇆ DO

| Direction | Frame | Notes |
|---|---|---|
| Bridge → DO (first message, mandatory within 5s) | `{ t:'hello', host, pid, version, startedAt }` | Identifies the bridge. DO replies with `bridge-ack` or `rejected`. |
| DO → Bridge | `{ t:'bridge-ack', at, previousDisconnect? }` | Slot claimed. |
| DO → Bridge | `{ t:'rejected', reason, holder:{host,pid,startedAt}, retryAfterMs }` | Another bridge already holds the slot. Daemon backs off ≥60s. |
| Bridge ⇄ DO | `{ t:'ping', ts }` / `{ t:'pong', ts }` | Keepalive. 25s interval, 15s timeout. |

### Browser ⇆ DO ⇆ Bridge (per-session)

| Direction | Frame |
|---|---|
| Browser → Bridge | `{ t:'spawn', sessionId, cols, rows, cwd?, shell? }` |
| Browser → Bridge | `{ t:'attach', sessionId, cols, rows }` (reattach after refresh) |
| Browser → Bridge | `{ t:'data', sessionId, d:'<keystrokes>' }` |
| Browser → Bridge | `{ t:'resize', sessionId, cols, rows }` |
| Browser → Bridge | `{ t:'kill', sessionId }` (explicit teardown) |
| Browser → Bridge | `{ t:'close', sessionId }` (client gone, keep PTY alive) |
| Bridge → Browser | `{ t:'spawned', sessionId, ok, error?, cols, rows, shell }` |
| Bridge → Browser | `{ t:'attached', sessionId, ok, error?, cols, rows }` |
| Bridge → Browser | `{ t:'data', sessionId, d:'<pty bytes>' }` |
| Bridge → Browser | `{ t:'exit', sessionId, code, signal? }` |
| DO → Browser (synthesized) | `{ t:'spawned', sessionId, ok:false, error, diag:{lastDisconnect, conflicts, lastConflict} }` (no bridge) |
| DO → Browser (synthesized) | `{ t:'bridge-down', sessionId, reason, code, host }` (bridge dropped after session was live) |

### Direct mode (no DO)

Same browser-side frames, just speaks WS directly to `ws://backend:5001/ws/terminal/<sessionId>` — no `sessionId` query param needed, the URL path carries it.

`POST /api/pty/create` is used out-of-band to spawn the PTY *before* the WS is opened. `POST /api/pty/attach` checks if a stored session is still alive; if yes, you can WS straight in without spawning. `POST /api/pty/close` ends the PTY.

---

## 4. Auth model

Two shared secrets, stored as Cloudflare Worker secrets:

| Secret | Used by | Where stored |
|---|---|---|
| `AGENT_SECRET` | Local bridge daemon when opening WS to `/v1/pty/bridge` | Env `DASHBOARD_AGENT_SECRET` **or** plaintext file `backend/data/agent-secret.txt` (40-byte random). Worker side: `wrangler secret put AGENT_SECRET`. |
| `API_SECRET` | Browser when opening WS to `/v1/pty/client` | Browser reads `localStorage.getItem('dashboard-api-token')`. Worker side: `wrangler secret put API_SECRET`. (Bridges may also use this token — `isClientAuth` accepts either.) |

The worker rejects WS upgrades with HTTP 401 if the token is missing/wrong. The bridge surfaces that as `SEVERE: handshake rejected by worker — HTTP 401` and logs prominently — it does **not** silent-retry.

---

## 5. Persistence model

This is the part that makes the terminal feel like a real desktop terminal — switching views in the dashboard does not kill your Claude Code session.

```
                         ┌─────────────────────────────────────┐
                         │ Module-level Map<slot, TerminalEntry>│  (terminalStore.ts)
                         │   slot = 'claude-main' | 'cwd:G:/…' │
                         └──────────────┬──────────────────────┘
                                        │
                ┌───────────────────────┴─────────────────────┐
                │                                             │
        ┌───────▼─────────┐                          ┌────────▼────────┐
        │ xterm.js        │  open()'d into wrapper   │ WebSocket       │
        │   (long-lived)  │                          │   (long-lived)  │
        └────┬────────────┘                          └────────┬────────┘
             │                                                │
             │  React mount → reparent wrapper into container │
             │  React unmount → reparent wrapper into         │
             │                  __pty-parking (hidden div)    │
             │                                                │
        ┌────▼────────────────────────────────────────────────▼────┐
        │ Browser refresh                                          │
        │   sessionId in localStorage["dashboard-pty-session-…"]   │
        │   On boot: send {t:'attach', sessionId}; on ok=false,    │
        │   fall back to {t:'spawn'}.                              │
        └──────────────────────────────────────────────────────────┘
```

**Three persistence layers**, each protecting against a different kind of teardown:

| Layer | Protects against | Mechanism |
|---|---|---|
| **Parking node** (`<div id="__pty-parking">` off-screen) | React view changes | xterm's DOM lives in the parking node when no `PtyTerminal` is mounted. On mount we `appendChild` the wrapper into the visible container; on unmount we move it back. xterm + WS are never disposed. |
| **localStorage `dashboard-pty-session-<slot>`** | Browser refresh | sessionId is stored per slot. On bootstrap we send `attach` first; on `ok:false` fall back to `spawn`. |
| **PTY-side keep-alive** | WS drops | `pty-service.js` does NOT kill the proc when the listener detaches — only an explicit `closePtySession()` or the 30-minute idle reaper kills it. The bridge also keeps PTYs alive when the worker WS drops (`onDown` doesn't `killAllSessions`). |

Per-cwd slotting: each cwd the user picks gets its own slot (`cwd:g:/projects/dashboard_v5`), so you can have several persistent shells open in different folders, each surviving navigation. Empty cwd falls back to the legacy `claude-main` slot for back-compat.

---

## 6. Boot sequence — daemon-priority gating

There are TWO processes that can run the bridge:

1. **The dashboard backend** (`app-launcher-backend.js`) — starts an inline `pty-bridge.js` after it binds the HTTP server.
2. **The standalone daemon** (`pty-bridge-daemon.js`) — installed via `install-pty-bridge.bat`, runs at logon, survives backend restarts.

Only one can hold the worker's single bridge slot. If both try, the second is `rejected` and backs off 60s. To avoid even that churn, the backend probes the daemon before starting its inline bridge:

```js
// app-launcher-backend.js (after server.listen)
if (chosenPort === PORT_RANGE_START) {
  isPtyBridgeDaemonHealthy().then(daemonHealthy => {
    if (daemonHealthy) {
      // daemon owns the slot. Schedule a 60s takeover poll in case it dies.
      scheduleInlineBridgeTakeover();
    } else {
      startPtyBridge(); // inline
    }
  });
}
```

```js
// isPtyBridgeDaemonHealthy() — fetches http://127.0.0.1:5181/status and
// resolves true iff JSON.wsReadyState === 1.
```

**Why daemon-priority instead of backend-priority:** the daemon's whole purpose is to survive backend restarts. If the daemon yields to the backend at startup, then the backend restarts, the daemon is left holding nothing and a stuck-holder window opens. Daemon-always-wins is simpler with no flap window.

**Bridge-slot eviction loop bug (historical, 2026-06-12):** the original DO used "newest-wins" replacement. Two backend instances (auto-port fallthrough: one on 5001, one on 5002) would each start their own bridge, kicking each other off every reconnect. The fix was to reject newcomers when a healthy bridge holds the slot (see `PtyRouter.attachBridge`). The 60s reject-backoff in `pty-bridge.js` prevents the rejected bridge from hammering.

**Stuck-holder bug (historical, 2026-06-14):** the daemon's `startWhenSafe()` only checked backend liveness at startup, then held the slot forever. After a backend restart, the inline bridge looped REJECTED every 60s. Visible warning sign: DO state `bridgeConflicts` tick up by ~1/min. Fix: invert priority — daemon always owns, backend defers.

---

## 7. Setup steps for a new dashboard

### A. Install dependencies

```bash
# Frontend
npm i @xterm/xterm @xterm/addon-fit @xterm/addon-web-links

# Backend
npm i node-pty ws
# Windows: you also need windows-build-tools (`npm i -g windows-build-tools`)
# or Visual Studio Build Tools + Python 3 in PATH for node-gyp.
```

### B. Copy the source files

```
src/features/terminal/PtyTerminal.tsx       (frontend component)
src/features/terminal/PtyTerminal.css
src/features/terminal/terminalStore.ts      (persistence singleton)
src/features/terminal/shellContext.ts       (AI integration registry)

backend/pty-service.js                      (node-pty wrapper)
backend/pty-bridge.js                       (outbound cloud WS)
backend/pty-bridge-daemon.js                (standalone process)

worker-signaling/src/pty-router.ts          (Durable Object)
install-pty-bridge.bat                      (Windows install)
```

`shellContext.ts` is optional — if you don't want AI command proposals, you can stub `registerSession/unregisterSession/pushScrollback/setActiveSession/getProposalsFor/runProposal/dismissProposal/subscribe` as no-ops in `PtyTerminal.tsx`.

### C. Wire the backend HTTP routes

In your equivalent of `app-launcher-backend.js`:

```js
import {
  createPtySession,
  attachListener as ptyAttach,
  detachListener as ptyDetach,
  writePty,
  resizePty,
  closePtySession,
  sessionExists as ptySessionExists,
  getSessionInfo as ptyGetSessionInfo,
} from './pty-service.js';
import { startPtyBridge, getBridgeStatus as getPtyBridgeStatus } from './pty-bridge.js';

// In the HTTP router:
//   POST /api/pty/create  → createPtySession(body) → { sessionId, cols, rows, shell }
//   POST /api/pty/attach  → check sessionExists, return info if alive
//   POST /api/pty/close   → closePtySession(sessionId)
//   GET  /api/pty/bridge-status → getPtyBridgeStatus()
```

WS upgrade handler:

```js
const ptyWss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const m = req.url.match(/^\/ws\/terminal\/([^/?#]+)/);
  if (!m) { /* other ws routes or destroy */ return; }
  const sessionId = m[1];
  ptyWss.handleUpgrade(req, socket, head, (ws) => {
    if (!ptyAttach(sessionId, ws)) {
      ws.send(JSON.stringify({ t: 'error', message: 'Unknown session' }));
      ws.close(4040, 'no session');
      return;
    }
    ws.on('message', (raw) => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.t === 'data' && typeof msg.d === 'string') writePty(sessionId, msg.d);
      else if (msg.t === 'resize' && msg.cols && msg.rows) resizePty(sessionId, msg.cols, msg.rows);
    });
    ws.on('close', () => ptyDetach(sessionId, ws));
    ws.on('error', () => ptyDetach(sessionId, ws));
  });
});
```

Boot sequence (after `server.listen`):

```js
// only the preferred-port instance starts the bridge — see §6.
if (chosenPort === PREFERRED_PORT) {
  isPtyBridgeDaemonHealthy().then(daemonHealthy => {
    if (daemonHealthy) scheduleInlineBridgeTakeover();
    else startPtyBridge();
  });
}
```

### D. Cloudflare Worker setup

Add to `worker-signaling/wrangler.toml`:

```toml
[durable_objects]
bindings = [
  # …existing bindings…
  { name = "PTY_ROUTER", class_name = "PtyRouter" },
]

[[migrations]]
tag = "v4-pty-router"
new_classes = ["PtyRouter"]
```

Export the DO from `src/index.ts`:

```ts
export { PtyRouter } from './pty-router';
```

Add the route block in `src/index.ts`:

```ts
if (url.pathname.startsWith('/v1/pty/')) {
  const token = url.searchParams.get('token') || request.headers.get('X-Dashboard-Token') || '';
  const agentSecret = (env as any).AGENT_SECRET || '';
  const apiSecret   = (env as any).API_SECRET   || '';
  const isBridgeAuth = !!token && (token === agentSecret);
  const isClientAuth = !!token && (token === apiSecret || token === agentSecret);

  let role: 'bridge' | 'client' | null = null;
  if (url.pathname === '/v1/pty/bridge') {
    if (!isBridgeAuth) return new Response('unauthorized', { status: 401 });
    role = 'bridge';
  } else if (url.pathname === '/v1/pty/client') {
    if (!isClientAuth) return new Response('unauthorized', { status: 401 });
    role = 'client';
  } else if (url.pathname === '/v1/pty/status') {
    const ns = (env as any).PTY_ROUTER as DurableObjectNamespace;
    const id = ns.idFromName('default');
    return ns.get(id).fetch(new Request(url.toString().replace('/v1/pty/status', '/'), request));
  }

  if (role) {
    const ns = (env as any).PTY_ROUTER as DurableObjectNamespace;
    const id = ns.idFromName('default');
    const fwd = new URL(url.toString());
    fwd.searchParams.set('role', role);
    return ns.get(id).fetch(new Request(fwd.toString(), request));
  }
  return new Response('Not found', { status: 404 });
}
```

Set secrets:

```bash
cd worker-signaling
npx wrangler secret put AGENT_SECRET   # paste 40+ random bytes
npx wrangler secret put API_SECRET     # paste the browser token
npx wrangler deploy
```

### E. Frontend wiring

```tsx
// Wherever your "terminal view" lives:
import PtyTerminal from './features/terminal/PtyTerminal';

<PtyTerminal
  backendUrl="http://localhost:5001"
  // cwd omitted → user picks via cwd bar; persisted to localStorage
  // slot omitted → derived from cwd; one persistent shell per folder
  onSessionEnd={() => console.log('shell exited')}
/>
```

The component reads:
- `localStorage['dashboard-api-token']` for the cloud-relay auth token
- `localStorage['dashboard-pty-backend-host']` to override backend host (LAN ip)
- `localStorage['dashboard-pty-session-<slot>']` for cross-refresh session resume
- `localStorage['terminal.pty.last-cwd']` and `localStorage['terminal.pty.recent-cwds']` for the cwd picker

The cloud-relay base URL is hardcoded in the component (`CLOUD_WS_BASE`). Edit that constant to point at your worker:

```ts
const CLOUD_WS_BASE = 'wss://<your-worker>.workers.dev';
```

### F. Install the daemon (Windows)

```bash
install-pty-bridge.bat
```

This drops `DashboardV5-PtyBridge.bat` into `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` and immediately spawns the daemon. Logs go to `logs/pty-bridge.log` relative to the install directory.

For Linux/macOS, equivalent systemd unit:

```ini
# ~/.config/systemd/user/pty-bridge.service
[Unit]
Description=Dashboard PTY Bridge Daemon
After=network-online.target

[Service]
ExecStart=/usr/bin/node /path/to/backend/pty-bridge-daemon.js
Restart=on-failure
RestartSec=5
Environment=DASHBOARD_AGENT_SECRET=...

[Install]
WantedBy=default.target
```

`systemctl --user enable --now pty-bridge`.

### G. Place the agent secret

```bash
# Either env:
export DASHBOARD_AGENT_SECRET="<the same value you set as wrangler secret AGENT_SECRET>"

# Or file:
echo -n "<value>" > backend/data/agent-secret.txt
```

### H. Verify

```bash
# Local daemon view (source of truth for the daemon itself):
curl http://127.0.0.1:5181/status

# Backend view (only meaningful if backend is running its own inline bridge):
curl http://127.0.0.1:5001/api/pty/bridge-status

# Worker DO view (source of truth for the cloud):
curl https://<your-worker>.workers.dev/v1/pty/status
```

Healthy steady state:

- Daemon: `status: "claimed"`, `wsReadyState: 1`
- DO: `bridgeConnected: true`, `bridgeConflicts: 0` (this last one **must** stay flat — rising = stuck-holder / eviction loop)

---

## 8. The Claude Code launcher

A purple button labeled `⚡ Claude (yolo)` appears in the status bar when status is `ready`. It runs:

```
cd /d G:\PROJECTS\dashboard_v5
claude --dangerously-skip-permissions
```

…by sending those lines as keystrokes through the same WS the user types into. `--dangerously-skip-permissions` (a.k.a. yolo) waives every tool-call prompt so Claude can edit the codebase without interruption.

State machine: `entry.claudeAlive` boolean.

| Set true | Set false |
|---|---|
| `launchClaudeYolo()` invoked | User types `/exit`, `/quit`, or `exit` at the shell |
| AI handoff routes a prompt and Claude was already alive | PTY exits (`onExit` from node-pty) |

The flag drives the AI handoff fast path: if Claude is already alive, the prompt is just typed straight in. If not, the launcher runs first, then `waitForClaudePrompt()` polls xterm's buffer for the REPL prompt signature (`›`, `❯`, or `>` at column 0) for up to 30s, then types the prompt. Tolerates the welcome banner, theme picker, and login flow.

**Critical env var on the backend:** `CLAUDECODE` is stripped from the child env in `pty-service.js`:

```js
const env = { ...process.env, TERM: 'xterm-256color' };
delete env.CLAUDECODE;
```

Without this, Claude inherits its own marker var from the dashboard's parent process and refuses to launch a child Claude. This is the single most common "claude won't start inside the dashboard terminal" bug.

---

## 9. AI shell-context integration

`shellContext.ts` is the bridge between your AI popup (`AiAssistantFab`) and the live PTY.

What the AI can do:

- Read up to 6 KB of cleaned (ANSI-stripped) scrollback from the active session via `getActiveScrollback()`.
- Propose a command via `queueProposal({ command, rationale })`. A chip appears above the terminal; user accepts with `Tab` or clicks Run, dismisses with `Esc` or clicks Dismiss.
- Receive a handoff: when the AI emits a `pty:send-to-claude` window CustomEvent (with `detail.prompt`), it's queued by `terminalStore.ts`'s `enqueueHandoff()` and drained as soon as `PtyTerminal` mounts. The handler launches Claude if needed, waits for the REPL prompt, then types the prompt.

```ts
// In your AI popup, to hand a prompt off to the terminal:
window.dispatchEvent(new CustomEvent('pty:send-to-claude', {
  detail: { prompt: 'fix the failing test in foo.test.ts' }
}));
```

The queue has a 30s TTL — if `PtyTerminal` still hasn't mounted by then, the prompt is dropped rather than firing late.

---

## 10. Diagnostic surfaces

When the cloud terminal shows `Bridge daemon not connected`, walk this list in order:

1. **`curl http://127.0.0.1:5181/status`** — is the daemon running? Look for `status: 'claimed'`. If `'no-secret'`, set `DASHBOARD_AGENT_SECRET` or write `backend/data/agent-secret.txt`. If `'rejected'`, another bridge already holds the slot — find it (`tasklist | findstr node`) and kill it.
2. **`curl http://127.0.0.1:5001/api/pty/bridge-status`** — if daemon is down, the backend should have started its inline bridge. Same fields as the daemon's view.
3. **`curl https://<worker>/v1/pty/status`** — the source of truth.
   - `bridgeConnected: false` + `lastDisconnect.host` ≠ your machine → some *other* host's bridge held the slot.
   - `bridgeConflicts` rising → stuck-holder bug or two bridges on this host fighting. Kill all `node` processes and restart the daemon.
   - `lastDisconnect.code: 4001 "another bridge already attached"` → exactly the reject path — backoff is working, but you have a duplicate process.

The DO ships a human-readable explanation as the `error` field on the synthesized `{t:'spawned', ok:false}` frame to the browser when no bridge is attached. The component shows that in the red status bar.

---

## 11. Adapting `CLOUD_WS_BASE` and host paths

If you're moving this to a new project, the constants below need updating:

| File | Constant | What |
|---|---|---|
| `src/features/terminal/PtyTerminal.tsx` | `CLOUD_WS_BASE` | Your worker URL — `wss://<name>.<account>.workers.dev`. |
| `src/features/terminal/PtyTerminal.tsx` | `launchClaudeYolo()` body — the `cd /d <path>\r` line | The project root the yolo button drops into. |
| `backend/pty-bridge.js` | `CLOUD_WS_BASE` env / default | Same worker URL. |
| `backend/app-launcher-backend.js` | `PORT_RANGE_START` (the backend's preferred port — 5001 in dashboard_v5) | The bridge only auto-starts inline when the backend wins this port, otherwise it assumes a sibling instance owns the slot. |
| `worker-signaling/wrangler.toml` | `account_id`, secrets | Standard wrangler stuff. |

If you don't need cloud-relay (LAN-only dashboard), you can delete `pty-bridge.js`, `pty-bridge-daemon.js`, `pty-router.ts`, the worker route block, and the entire `openCloudWs` path in `PtyTerminal.tsx`. The direct-mode path (`/api/pty/create` + `/ws/terminal/<sessionId>`) works standalone.

---

## 12. Known sharp edges

- **node-pty native build on Windows is finicky.** If `npm i node-pty` fails, install Visual Studio Build Tools (C++ workload) and a system Python 3, then `npm rebuild node-pty`.
- **xterm.open() must run when the wrapper is actually in the DOM tree.** The bootstrap parks the wrapper offscreen and defers `open()` to the first visible mount via `requestAnimationFrame`. Without that, font metrics measure wrong and you get blank cells.
- **xterm doesn't react to DOM reparenting on its own.** After moving the wrapper into a fresh container, you must call `fit.fit()` and `xterm.refresh(0, rows-1)` or the viewport stays frozen / stale.
- **Window resize handling is per-mount, not in the store.** ResizeObserver is on the React component's container; on unmount it disconnects. If you forget to re-attach on remount, the terminal stops following window resizes.
- **`CLAUDECODE` env strip is also needed in `terminal-service.js`** (the legacy line-buffered terminal) and in `app-launcher-backend.js`'s app spawn — same reason.
- **The DO is a singleton (`idFromName('default')`).** All traffic from all browsers goes through one Durable Object. That's fine for low-volume per-user use but is not horizontally scalable. If you need to scale, partition by `hostId` so each machine has its own DO and route `?host=` in the worker.
- **Bridge socket is also a singleton per DO** (this is by design — the eviction-loop fix). If you have multiple machines that should all be reachable, you need one DO per machine (above) and a separate `host-router` mapping browser sessions to the right DO. (Dashboard v5's `HostRouter` does this for system-control RPCs; the same pattern can be applied to PTYs.)
