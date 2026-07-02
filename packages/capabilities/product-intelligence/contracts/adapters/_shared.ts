/**
 * Shared adapter primitives used by every source-family adapter port.
 *
 * Lifted out of the per-source files so the barrel `index.ts` can
 * `export *` every adapter without name-collision errors.
 */

/** TOS-risk classification per concrete adapter implementation. The runtime
 *  uses this to prioritize (official-api > rapidapi > scrape-*) and to
 *  decide the auto-pause window when bot-detection fires. */
export type AdapterKind = 'official-api' | 'rapidapi' | 'scrape-browser' | 'scrape-http';

/** Reasons an adapter call can fail. Every method returns a discriminated
 *  union of `{ ok: true; data: T }` or one of these failure shapes — callers
 *  pattern-match on `reason` and apply the runtime's policy (retry,
 *  back-off, auto-pause, surface to operator). */
export type AdapterFailure =
  | { ok: false; reason: 'rate-limit'; retryAfterMs?: number }
  | { ok: false; reason: 'bot-detected'; retryAfterMs?: number }
  | { ok: false; reason: 'tos-block'; retryAfterMs?: number }
  | { ok: false; reason: 'auth-failed'; retryAfterMs?: number }
  | { ok: false; reason: 'transient'; retryAfterMs?: number }
  | { ok: false; reason: 'no-results'; retryAfterMs?: number };

export type AdapterResult<T> = { ok: true; data: T } | AdapterFailure;

/** Rate-limit + reachability probe response shape, common across sources. */
export interface AdapterHealth {
  ok: boolean;
  reason?: string;
  rateLimit?: { remaining: number; resetAt: string };
}
