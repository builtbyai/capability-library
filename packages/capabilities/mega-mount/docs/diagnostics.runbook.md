# mega-mount · diagnostics runbook

## Rung 1 — port reachable

Hit the health endpoint. Failure = capability process not running.

## Rung 2 — dependency reachability

Verify all `requires.capabilities` are healthy. A failed dependency cascades.

## Rung 3 — operation smoke

Trigger the simplest read operation (e.g. status query). Should return without side effects.

## Symptom → cause

See `sharp-edges.md` for known failure modes specific to this capability.
