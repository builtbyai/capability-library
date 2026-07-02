# content-dashboard · diagnostics runbook

## Rung 1 — health

Hit `/api/health`. 200 = capability process up.

## Rung 2 — dependency reachability

Verify all `requires.capabilities` are healthy.

## Rung 3 — operation smoke

Trigger the simplest read endpoint. Should return without side effects.

## Symptom → cause

See `sharp-edges.md` for known failure modes specific to this capability.
