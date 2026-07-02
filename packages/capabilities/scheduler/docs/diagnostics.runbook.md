# scheduler · diagnostics runbook

## Rung 1 — `GET /api/scheduler/health`
Returns `{ lastTickAt, leaderHost, tickIntervalMs }`. `lastTickAt` older than `2 * tickIntervalMs` → loop halted (out-of-disk on sqlite is the usual cause).

## Rung 2 — `GET /api/scheduler/jobs/:id/runs`
Lists run history. Pattern of `error.code: 'no_handler'` → handler-registration never ran at boot. Restart the consumer capability.

## Rung 3 — clock drift
`compare local clock to NTP`. Drift > 30s misaligns cron windows.

## Symptom → cause
| Symptom | Cause |
|---|---|
| Job stuck in retrying | Handler not registered. Sharp-edges #3. |
| Tick stopped | DB unwritable. Check `MMD_SCHEDULER_DB`. |
| Same job fired twice at same second | Two leaders. Sharp-edges #4. |
