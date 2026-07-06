# Architecture — local-agent-terminal

## The chain

```
Browser
  → React PtyTerminal (frontend/PtyTerminal.tsx)
  → terminalStore singleton (xterm + WebSocket, frontend/terminalStore.ts)
  → WebSocket
     ├── direct mode  → backend/routes.ts → pty-service.ts → node-pty
     └── cloud mode   → Cloudflare Worker (cloudflare/index.ts)
                       → PtyRouter Durable Object (cloudflare/pty-router.ts)
                       → bridge daemon (backend/pty-bridge-daemon.ts → pty-bridge.ts)
                       → pty-service.ts → node-pty → real shell / Claude Code
```

The Durable Object is the **only** place a bridge socket and browser sockets
coexist. It cross-routes JSON frames by `sessionId` and never inspects payloads
beyond that field.

## Responsibilities

- **terminalStore** owns all hard state (the xterm instance, the socket, the
  session id, `claudeAlive`). React components are thin views; this is why a
  terminal survives a tab switch.
- **pty-service** owns node-pty processes and fans output to any number of
  attached listener sockets. Detaching a listener never kills the process.
- **pty-bridge** holds the worker's single bridge slot and multiplexes every
  browser session over that one socket.
- **PtyRouter (DO)** arbitrates the bridge slot and relays frames.

## Persistence model (three layers)

1. **React unmount** → the xterm DOM node is moved into a hidden `#__pty-parking`
   element, not destroyed; moved back on remount.
2. **Browser refresh** → the PTY `sessionId` is stored in `localStorage`
   (`dashboard-pty-session-<slot>`); on load we re-attach instead of spawning.
3. **WebSocket hiccup** → reconnect + re-attach to the same session. On the host
   side, a worker drop keeps PTYs alive (the daemon reconnects and re-claims).

## Boot sequence (cloud mode)

1. Worker is deployed with `AGENT_SECRET` + `API_SECRET`.
2. Bridge daemon starts at logon, connects to `/v1/pty/bridge?token=AGENT_SECRET`,
   sends `hello`, receives `bridge-ack`, and keeps the slot warm with ping/pong.
3. Backend, if it wins its preferred port, checks the daemon's `/status`. If the
   daemon is healthy it **defers**; otherwise it starts an inline bridge and polls
   to take over only if the daemon disappears (`bootBridge` in `routes.ts`).
4. Browser opens `/v1/pty/client?token=API_SECRET&sessionId=…` and sends
   `spawn` (or `attach` after a refresh).

## Auth model

- **Bridge → worker**: `AGENT_SECRET` (the daemon's secret; file or env).
- **Browser → worker**: `API_SECRET` (the `dashboard-api-token` in localStorage).
- A 401 on the bridge handshake is treated as **fatal** (see sharp-edges).
