/**
 * Per-key throttle — the canonical case is web-clipper limiting fetches to N
 * QPS PER DOMAIN, not globally. Same primitive applies to email-connector
 * (per-provider QPS), bulk-media-import (per-R2-bucket parallelism), and
 * replicate-api (per-token rate limit).
 *
 * Minimal implementation: token bucket per key. Not as featureful as
 * `p-throttle` but has zero deps and lives in core.
 */

export interface KeyedThrottleOptions<T> {
  /** Tokens (requests) per second per key. */
  qps: number;
  /** Burst size — how many can stack up while idle. Defaults to `qps`. */
  burst?: number;
  keyFn: (input: T) => string;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export class KeyedThrottle<T> {
  private buckets = new Map<string, Bucket>();
  private readonly qps: number;
  private readonly burst: number;
  private readonly keyFn: (input: T) => string;

  constructor(opts: KeyedThrottleOptions<T>) {
    this.qps = opts.qps;
    this.burst = opts.burst ?? Math.max(1, Math.ceil(opts.qps));
    this.keyFn = opts.keyFn;
  }

  /** Resolves when a token is available for the input's key. */
  async acquire(input: T): Promise<void> {
    const key = this.keyFn(input);
    while (true) {
      const now = Date.now();
      let b = this.buckets.get(key);
      if (!b) {
        b = { tokens: this.burst, lastRefillMs: now };
        this.buckets.set(key, b);
      }
      const elapsed = (now - b.lastRefillMs) / 1000;
      const refill = elapsed * this.qps;
      b.tokens = Math.min(this.burst, b.tokens + refill);
      b.lastRefillMs = now;
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - b.tokens) / this.qps) * 1000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  /** Convenience: acquire then run. */
  async run<R>(input: T, fn: () => Promise<R>): Promise<R> {
    await this.acquire(input);
    return fn();
  }
}
