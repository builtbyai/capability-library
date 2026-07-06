# local-agent-terminal

> A persistent, browser-embedded terminal backed by a real PTY — with an optional
> Cloudflare relay so you can reach your machine's shell from anywhere, and
> pluggable **launch profiles** (Claude Code is just one of them).

This is the mature **reference capability** for MultimarcDown. Every other
capability in the library is meant to follow this shape: `UI + Protocol +
Runtime + Persistence + Auth + Diagnostics + Setup + Sharp Edges`.

## What you get

| Layer | File(s) |
|------|---------|
| UI surface (React) | `frontend/PtyTerminal.tsx` + `PtyTerminal.css` |
| Persistence (survives unmount/refresh/WS drop) | `frontend/terminalStore.ts` |
| AI integration (scrollback, proposals, handoff) | `frontend/shellContext.ts` |
| Launch profiles (Claude / shells / dev servers) | `frontend/launchProfiles.ts` |
| Wire protocol (one schema, three speakers) | `contracts/protocol.ts` |
| Deploy-time config (one place for every constant) | `contracts/config.ts` |
| PTY runtime (node-pty lifecycle) | `backend/pty-service.ts` |
| Cloud bridge (outbound WS, multiplexing) | `backend/pty-bridge.ts` |
| Standalone daemon (survives backend restarts) | `backend/pty-bridge-daemon.ts` |
| Direct-mode routes + boot gating | `backend/routes.ts` |
| Cloudflare relay (Durable Object) | `cloudflare/pty-router.ts`, `cloudflare/index.ts` |
| Install + verify | `scripts/` |

## Two modes

- **Direct** — browser talks to your backend over LAN/localhost (`/ws/terminal/:id`).
  No cloud needed.
- **Cloud** — browser → Cloudflare Worker → Durable Object → your machine's
  **bridge daemon** → node-pty. Reach your shell from any network.

```
Browser → xterm.js → WebSocket → Cloudflare DO relay → bridge daemon → node-pty → real shell / Claude Code
```

## Quick start (cloud mode)

```bash
# 1. deploy the relay worker
cd cloudflare && npx wrangler deploy
npx wrangler secret put AGENT_SECRET   # 40+ random bytes
npx wrangler secret put API_SECRET     # the browser token

# 2. on the host machine, drop the agent secret + start the daemon
echo "<same AGENT_SECRET>" > backend/data/agent-secret.txt
MMD_CLOUD_WS_BASE=wss://your-worker.workers.dev node dist/backend/pty-bridge-daemon.js
# or install it permanently: scripts/install.sh  (Linux) / scripts/install-pty-bridge.bat (Windows)

# 3. verify the whole chain
node --loader ts-node/esm scripts/verify.ts --worker https://your-worker.workers.dev
```

In the browser:

```tsx
import { PtyTerminal } from '@multimarcdown/local-agent-terminal/frontend';
import { defaultTerminalConfig } from '@multimarcdown/local-agent-terminal/contracts/config';

const config = defaultTerminalConfig('wss://your-worker.workers.dev');

<PtyTerminal slot="main" config={config} defaultMode="cloud" />;
```

Set the browser token once: `localStorage.setItem('dashboard-api-token', '<API_SECRET>')`.

## Launch profiles

Claude is no longer hard-coded. `contracts/config.ts` ships profiles for
`claude-yolo`, `claude-safe`, `bash`, and `npm-dev`; add your own. Each declares
a `riskLevel` and `requiresConfirmation`, and privileged profiles pop a
confirmation modal before running. See `manifest.yaml` for the full set.

## Docs

- [`docs/architecture.md`](docs/architecture.md) — how the pieces fit, boot sequence.
- [`docs/diagnostics.runbook.md`](docs/diagnostics.runbook.md) — the 3-rung triage ladder.
- [`docs/sharp-edges.md`](docs/sharp-edges.md) — **read this before deploying.**
