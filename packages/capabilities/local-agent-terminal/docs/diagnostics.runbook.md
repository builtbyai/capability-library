# Diagnostics runbook — local-agent-terminal

When the terminal won't connect or Claude won't start, walk these three rungs
**in order**. Each rung has a single source of truth.

## Rung 1 — the bridge daemon (host machine)

```
curl http://127.0.0.1:5181/status
```

Expect: `{"status":"claimed","wsReadyState":1,...}`.

- `status: "no-secret"` → the daemon has no `AGENT_SECRET`. Write it to
  `backend/data/agent-secret.txt` or set `DASHBOARD_AGENT_SECRET`, then restart.
- `status: "rejected"` → another bridge already holds the worker slot. Find and
  kill the stray process (`tasklist | findstr node` / `pgrep -fa pty-bridge`),
  then restart this daemon.
- connection refused → the daemon isn't running. Start it (`scripts/install.sh`
  or `install-pty-bridge.bat`, or run `pty-bridge-daemon.js` directly).

## Rung 2 — the backend inline bridge

```
curl http://127.0.0.1:5001/api/pty/bridge-status
```

The backend only runs an inline bridge when **no healthy daemon exists** and it
won its preferred port. If both the daemon (rung 1) and this are down, nothing is
holding the slot — start the daemon.

## Rung 3 — the worker Durable Object

```
curl https://<worker>/v1/pty/status
```

Expect: `{"bridgeConnected":true,"bridgeConflicts":0,...}`.

- **`bridgeConflicts` must stay flat.** A rising count means two bridges are
  fighting for the slot — see sharp-edges.md ("eviction loop").
- `lastDisconnect.host` ≠ your machine → some other host held the slot.
- `bridgeConnected:false` with rung 1 healthy → secret mismatch between the
  daemon's `AGENT_SECRET` and the worker's `AGENT_SECRET`.

## One-shot

```
node --loader ts-node/esm scripts/verify.ts --worker https://<worker>
```

Walks all three rungs and exits non-zero on a rising conflict count or a
bridge that is connected nowhere.
