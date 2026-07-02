# Diagnostics runbook — <capability>

Ordered probes (the "walk this in order" ladder). Each rung: what to run, what a pass looks like, what to do on failure. Cheapest probes first; if Rung 1 fails, Rung 2 isn't useful.

## Rung 1 — capability process up

```bash
curl -fsSL http://127.0.0.1:<PORT>/api/health
```

Expect `200 OK`. Failure: capability service not running. Check `npm run dev` / systemd unit / NSSM service per deployment.

## Rung 2 — dependency reachability

Verify every `requires.capabilities` in `manifest.yaml` is healthy. A failed dependency cascades — there's no point diagnosing this capability if its dependencies are down.

```bash
# example: check connector-config + notify before debugging X
curl -fsSL http://127.0.0.1:5102/api/health   # connector-config
curl -fsSL http://127.0.0.1:5107/api/health   # notify
```

## Rung 3 — operation smoke (read-only)

The simplest read-only endpoint that touches every code path. Should return without side effects. Compare the response shape to `contracts/events.ts`.

## Rung 4 — write/mutation smoke

If applicable, the smallest write that round-trips through the persistence + event-emission paths. Verify both the row landed AND the corresponding `cap.event` was emitted on the bus.

## Symptom → cause

| Symptom | Likely cause |
|---|---|
| <Symptom 1> | <Cause — point at the relevant sharp-edges.md entry by number> |
| <Symptom 2> | <Cause> |

---

Keep this updated as you debug. The point of a runbook is that the NEXT person
(or the next-you, 3am) can fix it without re-discovering everything.
