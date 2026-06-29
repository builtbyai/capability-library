/**
 * Retry with exponential or fixed backoff. Wraps an async fn; classifies each
 * thrown error as 'retry' or 'fail'. Used by bulk-media-import (R2 PUT retries),
 * web-clipper (per-domain rate-limit), document-ingestion (OCR), email-connector
 * (provider rate limits), and replicate-api (429 with Retry-After).
 *
 * Layered on top of the existing RetryPolicy notion from jobs.ts so the same
 * shape works both in cron retries and in inline call-site retries.
 */

export interface BackoffPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  baseMs: number;
  maxMs?: number;
  /** Add up to ±jitterFraction × baseMs of jitter to each sleep. */
  jitterFraction?: number;
}

export type RetryClassification = 'retry' | 'fail';

export interface BackoffAttempt {
  attempt: number;
  err: unknown;
  delayMs: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withBackoff<T>(
  fn: () => Promise<T>,
  policy: BackoffPolicy,
  classify: (err: unknown) => RetryClassification = () => 'retry',
  onAttempt?: (a: BackoffAttempt) => void,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === policy.maxAttempts || classify(err) === 'fail') throw err;
      const base = policy.backoff === 'fixed' ? policy.baseMs : policy.baseMs * Math.pow(2, attempt - 1);
      const capped = policy.maxMs ? Math.min(base, policy.maxMs) : base;
      const jitter = policy.jitterFraction ? capped * policy.jitterFraction * (Math.random() * 2 - 1) : 0;
      const delayMs = Math.max(0, Math.round(capped + jitter));
      onAttempt?.({ attempt, err, delayMs });
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
