/**
 * scheduler contracts. Cron triggers; handlers are registered with
 * @multimarcdown/core jobs and named `<capabilityId>:<handler>`.
 */
import { z } from 'zod';

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  backoff: z.enum(['fixed', 'exponential']).default('exponential'),
  baseMs: z.number().int().min(100).default(500),
});
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

export const ScheduledJobSchema = z.object({
  jobId: z.string().uuid(),
  name: z.string().min(1),
  capabilityId: z.string(),
  handler: z.string(),
  cron: z.string(),
  timezone: z.string().default('UTC'),
  enabled: z.boolean().default(true),
  retryPolicy: RetryPolicySchema,
  input: z.record(z.unknown()).default({}),
  lockKey: z.string().optional(),
});
export type ScheduledJob = z.infer<typeof ScheduledJobSchema>;

export const JobScheduledSchema = ScheduledJobSchema;
export const JobStartedSchema   = z.object({ jobId: z.string(), runId: z.string(), attempt: z.number(), startedAt: z.string() });
export const JobCompletedSchema = z.object({ jobId: z.string(), runId: z.string(), durationMs: z.number(), output: z.unknown().optional() });
export const JobFailedSchema    = z.object({ jobId: z.string(), runId: z.string(), error: z.object({ code: z.string(), message: z.string() }), willRetry: z.boolean() });
export const JobRetryingSchema  = z.object({ jobId: z.string(), runId: z.string(), nextAttemptAt: z.string() });
export const JobDisabledSchema  = z.object({ jobId: z.string(), reason: z.enum(['manual', 'exhausted-retries', 'handler-missing']) });
export const SchedulerTickSchema= z.object({ tickAt: z.string(), dueCount: z.number() });

export const EVENT_NAMES = {
  scheduled: 'scheduler.job.scheduled',
  started:   'scheduler.job.started',
  completed: 'scheduler.job.completed',
  failed:    'scheduler.job.failed',
  retrying:  'scheduler.job.retrying',
  disabled:  'scheduler.job.disabled',
  tick:      'scheduler.tick',
} as const;

export interface CronRegistration {
  name: string;
  cron: string;
  timezone?: string;
  capabilityId: string;
  handler: string;
  input: Record<string, unknown>;
  retryPolicy?: RetryPolicy;
  lockKey?: string;
}

export interface SchedulerPort {
  registerCron(reg: CronRegistration): Promise<{ jobId: string }>;
  runNow(jobId: string): Promise<{ runId: string }>;
  listRuns(jobId: string): Promise<Array<{ runId: string; status: string; startedAt: string; durationMs?: number }>>;
  disable(jobId: string): Promise<void>;
}
