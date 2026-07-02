# scheduler  ·  _planned_

Recurring jobs with retries, locks, and run history. Built on the core job runner.

**Surfaces:** CronExpressionEditor, ScheduleBuilder, JobList, JobRunHistory, RetryPolicyEditor, ManualRunButton
**Emits:** `job.scheduled`, `job.started`, `job.completed`, `job.failed`, `job.retrying`, `job.disabled`

**Canonical model** (`contracts/events.ts`):
```ts
type ScheduledJob = {
  jobId: string; name: string;
  capabilityId: string; handler: string;   // e.g. 'email-connector:syncAccount'
  cron: string; timezone: string; enabled: boolean;
  retryPolicy: { maxAttempts: number; backoff: 'fixed' | 'exponential' };
  input: Record<string, unknown>;
};
```

**Boundary rule:** cron contains **no business logic**. It triggers named handlers
registered with `@multimarcdown/core` jobs (`jobs.register('email-connector:syncAccount', …)`).
