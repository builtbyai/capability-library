# ai-file-renamer · diagnostics runbook

## Rung 1 — rollback log writable
`POST /api/rename/_probe-log` → appends a probe row then deletes it. Failure = `rename_history` path wrong or read-only.

## Rung 2 — model provider
`ModelInvocation.ping()` returns shape-compliant response. Failure = adapter misconfigured (deepseek key missing).

## Rung 3 — smoke
Dry-run on `/tmp/renamer-smoke/` with 10 dummy files. Apply then rollback. Tree must be byte-identical to original.

## Symptom → cause
| Symptom | Cause |
|---|---|
| Rollback restores nothing | rename_history not written. Check Rung 1. |
| Case-only renames silently no-op | Sharp-edges #1. Use 2-step rename. |
| Batch rejected with duplicate_in_batch | AI proposed the same name twice. Tune prompt to include file path. |
