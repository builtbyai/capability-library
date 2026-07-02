# connector-config · diagnostics runbook

## Rung 1 — env check
`MMD_SECRET_ENCRYPTION_KEY` set and 32 bytes. `MMD_CONNECTORS_DB` writable.

## Rung 2 — encrypt-roundtrip
`POST /api/connectors/_probe-encrypt` → encrypts then decrypts a known plaintext. Mismatch = key drift (recent rotation without dual-key window).

## Rung 3 — health rollup
`GET /api/connectors` → check `status` per row. `failed` + `lastTestDetail` containing 'decryption failed' = key rotated without re-encrypt pass.

## Symptom → cause
| Symptom | Cause |
|---|---|
| Capability X says credentials invalid | `GET /api/connectors/:id` → `lastTestDetail` shows real cause. |
| Connector list empty after restart | sqlite path wrong; check working dir. |
| All decrypt failures | Key changed. See sharp-edges #1. |
