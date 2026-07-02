# Sharp edges — read before deploying

These are the failure modes that cost real debugging time. Each maps to a guard
in the code.

## 1. `CLAUDECODE` must be stripped from the child env
A Claude Code process sets `CLAUDECODE=1`. If you spawn a PTY from inside that
process and inherit the env, a **nested** Claude refuses to launch. `pty-service.ts`
deletes `CLAUDECODE` from the child env in `childEnv()`. If you rewrite the
spawn path, keep that line.

## 2. The eviction loop (newest-wins is wrong)
If two backends each run a bridge, a "newest connection wins" policy makes them
evict each other forever — the slot flaps and every session dies repeatedly.
**Fix:** the Durable Object *rejects* a newcomer when a healthy bridge already
holds the slot (`attachBridge` in `pty-router.ts` sends `rejected` + closes 4001).
The rejected bridge backs off ≥ 60s (`pty-bridge.ts`). Watch `bridgeConflicts`
in `/v1/pty/status`; it should stay flat.

## 3. Daemon priority
The standalone daemon's whole job is to outlive backend restarts, so it **always**
owns the slot. The backend defers to a healthy daemon and only takes over if the
daemon's `/status` stops reporting `wsReadyState:1` (`bootBridge` +
`scheduleInlineBridgeTakeover`). Never run both unconditionally.

## 4. Single Durable Object = single host
`idFromName('default')` makes the relay a singleton — one bridge, one machine.
That is intentional for a personal dashboard. To support multiple hosts, key the
DO by host (`idFromName(hostId)`) and route clients to the right host's DO; the
client must then send a `hostId`. Until you do that, a second machine's bridge
will be rejected by design.

## 5. 401 is fatal — no silent retry
If the bridge handshake gets HTTP 401, the `AGENT_SECRET` is wrong. Retrying
hammers the worker and never succeeds, so `pty-bridge.ts` logs `severe` and
**stops** (it does not reconnect). Fix the secret and restart deliberately.

## 6. Worker drop keeps PTYs alive
When the worker WS drops, the bridge does **not** kill local PTYs — your shells
and running Claude sessions keep going. The DO notifies live clients with
`bridge-down` so the UI shows a clear message, and the daemon reconnects and
re-claims. Don't "clean up" PTYs on socket close.

## 7. Idle reaper
PTYs with zero listeners are killed after `idleReaperMs` (default 30 min) to stop
orphan accumulation. Long-running unattended jobs in a terminal will be reaped —
raise the value or keep a listener attached.
