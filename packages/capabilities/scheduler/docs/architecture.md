# scheduler · architecture

Cron parser → due-job picker → leader-election lock → `jobs.dispatch(name, input)`. Handlers live in their capabilities; scheduler only routes. Tick interval default 1s; jobs claimed under `lockKey` (e.g. one email-sync per account).

Run history persists to sqlite (`MMD_SCHEDULER_DB`). Retries follow `RetryPolicy` from contracts. Three failure classes: transient (retry per policy), `handler-missing` (disable immediately, emit `scheduler.job.disabled{reason:'handler-missing'}`), exhausted (disable + emit `disabled{reason:'exhausted-retries'}`).
