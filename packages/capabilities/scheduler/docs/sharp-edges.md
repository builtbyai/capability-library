# scheduler · sharp edges

## 1. Cron handlers MUST be idempotent
The runner re-invokes on retry. Handlers store a `lastSuccessfulCursor` and resume from it. Otherwise: "email synced 50 messages" becomes "email re-emitted 50 received events for the third time."

## 2. DST silently double-fires or skips
`0 2 * * *` fires twice on fall-back, zero times on spring-forward unless `timezone:'UTC'`. UTC is the default; America/* timezones break rate-limited or financial jobs.

## 3. `handler-missing` is non-retryable
When a handler is renamed, queued runs re-fail `maxAttempts` before disabling. Mark `handler-missing` as non-retryable immediately and emit `scheduler.job.disabled` on first occurrence.

## 4. Two scheduler processes = job fires twice
Leader-election lock prevents this. `GET /api/scheduler/health.leaderHost` must show ONE host. Detection: same `jobId` ran twice within one second across runs.
