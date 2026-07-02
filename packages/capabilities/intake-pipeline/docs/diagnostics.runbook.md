# intake-pipeline · diagnostics runbook

Three rungs of health, in order from cheapest to most invasive.

## Rung 1 — storage-driver write probe

```bash
curl -X POST http://127.0.0.1:5101/api/intake \
  -F 'file=@/dev/null;filename=probe.bin'
```

Expect 201 + `{ objectId: "...", ref: { ... } }`. If 5xx, storage driver is wrong — check `INTAKE_STORAGE_DRIVER`, `INTAKE_STORAGE_ROOT`, and (for r2/s3) the credentials.

## Rung 2 — hash collision metric

```bash
curl http://127.0.0.1:5101/api/intake/_metrics
```

Expect `duplicate_hits / total < 0.05` under normal load. If `>0.20`, either the deployment is correctly deduping a recurring bulk-import (fine), or the hash function regressed (not fine — verify with a fresh `hashBytes` round-trip).

## Rung 3 — route table dump

```bash
curl http://127.0.0.1:5101/api/intake/_routes
```

Returns the live MIME → capability map. If a routing decision looks wrong, this is the source of truth — overrides at deploy time happen here.

## Symptom → cause table

| Symptom | Likely cause |
|---|---|
| Object stuck in `received` but never `stored` | Storage driver hung (R2 5xx, fs ENOSPC). Check driver logs. |
| Object stored but no `routed` event fired | MIME has no entry in route table. Falls to deadletter queue (`intake.object.rejected{reason:'mime_blocked'}`). |
| Downstream cap never receives object | Subscribed to `received` instead of `routed`. Re-read sharp-edges #4 and #5. |
| Two storage writes for the same file | Hashed AFTER write instead of WHILE. Re-read sharp-edges #1. |
