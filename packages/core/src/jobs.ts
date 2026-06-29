/**
 * A minimal job runner with retry, backoff, cancellation, and progress events.
 *
 * Per the spec: long-running work (PDF extraction, email sync, upscaling, RAG
 * indexing) should flow through ONE execution layer rather than ad-hoc async.
 * Cron triggers named jobs; named jobs call capability handlers.
 *
 * This in-memory implementation is the reference contract. A production swap
 * (BullMQ, Cloudflare Queues) implements the same `JobRunner` shape.
 */
import { bus } from './events.js';

export type JobState =
  | 'queued'
  | 'running'
  | 'waiting_for_input'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  /** Base delay in ms. */
  baseMs: number;
}

export interface JobProgress {
  current: number;
  total?: number;
  label?: string;
}

export interface Job<I = unknown, O = unknown> {
  jobId: string;
  capabilityId: string;
  handler: string;
  input: I;
  state: JobState;
  attempts: number;
  retryPolicy: RetryPolicy;
  output?: O;
  error?: { code: string; message: string; retryable: boolean };
  progress?: JobProgress;
  createdAt: string;
  updatedAt: string;
}

export interface JobContext<I> {
  input: I;
  /** Report progress; emits `workflow.step.progress`. */
  progress(p: JobProgress): void;
  /** Throws if the job was cancelled; call at safe checkpoints. */
  checkCancelled(): void;
}

export type JobFn<I = unknown, O = unknown> = (ctx: JobContext<I>) => Promise<O>;

export const defaultRetry: RetryPolicy = { maxAttempts: 3, backoff: 'exponential', baseMs: 500 };

export class JobRunner {
  private handlers = new Map<string, JobFn<any, any>>();
  private jobs = new Map<string, Job>();
  private cancelled = new Set<string>();

  /** Register a handler keyed by `capabilityId:handler` (e.g. 'gmail:syncAccount'). */
  register<I, O>(key: string, fn: JobFn<I, O>): void {
    this.handlers.set(key, fn as JobFn);
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  cancel(jobId: string): void {
    this.cancelled.add(jobId);
  }

  async enqueue<I, O>(
    capabilityId: string,
    handler: string,
    input: I,
    retry: RetryPolicy = defaultRetry,
  ): Promise<Job<I, O>> {
    const job: Job<I, O> = {
      jobId: crypto.randomUUID(),
      capabilityId,
      handler,
      input,
      state: 'queued',
      attempts: 0,
      retryPolicy: retry,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(job.jobId, job as Job);
    await bus.emit('workflow.started', capabilityId, { jobId: job.jobId, handler });
    // fire-and-forget execution; callers poll via get() or listen on the bus.
    void this.execute(job as Job);
    return job;
  }

  /**
   * Enqueue a job and await its terminal state, resolving with the handler's
   * output (or rejecting on failure/cancellation). This is the compose-and-await
   * primitive workflows use to chain capabilities through the single execution
   * layer, instead of reading enqueue()'s fire-and-forget Job.
   */
  async run<O = unknown, I = unknown>(
    capabilityId: string,
    handler: string,
    input: I,
    retry: RetryPolicy = defaultRetry,
    timeoutMs?: number,
  ): Promise<O> {
    const job = await this.enqueue<I, O>(capabilityId, handler, input, retry);
    return await new Promise<O>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        offCompleted();
        offFailed();
        fn();
      };
      const check = (): void => {
        const j = this.jobs.get(job.jobId);
        if (!j) return;
        if (j.state === 'completed') done(() => resolve(j.output as O));
        else if (j.state === 'failed') done(() => reject(new Error(j.error?.message ?? `job ${j.jobId} failed`)));
        else if (j.state === 'cancelled') done(() => reject(new Error(`job ${j.jobId} cancelled`)));
      };
      // Guard a handler that never settles: without this, run() would hang
      // forever and leak the two bus subscriptions below. Opt-in (default: none).
      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(
          () => done(() => reject(new Error(`job ${job.jobId} timed out after ${timeoutMs}ms`))),
          timeoutMs,
        );
      }
      // Subscribe first, then check directly: enqueue() already kicked off
      // execute() fire-and-forget, so the job may already have settled.
      const offCompleted = bus.on('workflow.completed', () => check());
      const offFailed = bus.on('workflow.step.failed', () => check());
      check();
    });
  }

  private async execute(job: Job): Promise<void> {
    const key = `${job.capabilityId}:${job.handler}`;
    const fn = this.handlers.get(key);
    if (!fn) {
      this.fail(job, 'no_handler', `no handler registered for ${key}`, false);
      return;
    }

    while (job.attempts < job.retryPolicy.maxAttempts) {
      job.attempts += 1;
      this.transition(job, 'running');
      if (this.cancelled.has(job.jobId)) return this.transition(job, 'cancelled');

      const ctx: JobContext<unknown> = {
        input: job.input,
        progress: (p) => {
          job.progress = p;
          job.updatedAt = new Date().toISOString();
          void bus.emit('workflow.step.progress', job.capabilityId, { jobId: job.jobId, progress: p });
        },
        checkCancelled: () => {
          if (this.cancelled.has(job.jobId)) throw new JobCancelled(job.jobId);
        },
      };

      try {
        const output = await fn(ctx);
        job.output = output;
        this.transition(job, 'completed');
        await bus.emit('workflow.completed', job.capabilityId, { jobId: job.jobId });
        return;
      } catch (err) {
        if (err instanceof JobCancelled) return this.transition(job, 'cancelled');
        const retryable = job.attempts < job.retryPolicy.maxAttempts;
        if (!retryable) {
          this.fail(job, 'handler_error', errMessage(err), false);
          return;
        }
        await delay(backoffMs(job.retryPolicy, job.attempts));
      }
    }
  }

  private transition(job: Job, state: JobState): void {
    job.state = state;
    job.updatedAt = new Date().toISOString();
  }

  private fail(job: Job, code: string, message: string, retryable: boolean): void {
    job.error = { code, message, retryable };
    this.transition(job, 'failed');
    void bus.emit('workflow.step.failed', job.capabilityId, { jobId: job.jobId, error: job.error });
  }
}

class JobCancelled extends Error {
  constructor(jobId: string) {
    super(`job ${jobId} cancelled`);
  }
}

function backoffMs(policy: RetryPolicy, attempt: number): number {
  return policy.backoff === 'exponential' ? policy.baseMs * 2 ** (attempt - 1) : policy.baseMs;
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const jobs = new JobRunner();
