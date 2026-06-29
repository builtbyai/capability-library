/**
 * HttpJsonClient — typed JSON-over-HTTP client. Generalized out of
 * replicate-api/backend/replicate.client.ts so adapters/{replicate,deepseek,
 * anthropic,ollama} share one transport.
 *
 * Honors Retry-After, supports cursor pagination, and lets the caller swap the
 * fetch implementation (so a worker context can pass `fetch` from its global).
 */
import type { ZodType } from 'zod';
import { withBackoff, type BackoffPolicy } from './backoff.js';

export interface HttpClientConfig {
  baseUrl: string;
  /** Returns the auth header(s) for each request. Implement per provider. */
  buildHeaders: () => Record<string, string> | Promise<Record<string, string>>;
  userAgent?: string;
  fetch?: typeof globalThis.fetch;
  maxRetries?: number;
  backoff?: BackoffPolicy;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Extra headers, e.g. `Prefer: wait=30`. */
  headers?: Record<string, string>;
}

export class HttpJsonError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
    public readonly url: string,
    public readonly retryAfterSec?: number,
  ) {
    super(`HTTP ${status} from ${url}: ${bodyText.slice(0, 200)}`);
  }
}

export class HttpJsonClient {
  private readonly cfg: Required<Pick<HttpClientConfig, 'baseUrl' | 'buildHeaders'>> & HttpClientConfig;

  constructor(cfg: HttpClientConfig) {
    this.cfg = { ...cfg, fetch: cfg.fetch ?? globalThis.fetch };
  }

  async requestRaw(path: string, opts: RequestOptions = {}): Promise<unknown> {
    const url = this.buildUrl(path, opts.query);
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}), ...(await this.cfg.buildHeaders()) };
    if (this.cfg.userAgent) headers['user-agent'] = this.cfg.userAgent;
    const policy: BackoffPolicy = this.cfg.backoff ?? { maxAttempts: this.cfg.maxRetries ?? 3, backoff: 'exponential', baseMs: 500, maxMs: 30_000, jitterFraction: 0.3 };
    const fetchFn = this.cfg.fetch!;

    return withBackoff(
      async () => {
        const res = await fetchFn(url, {
          method: opts.method ?? 'GET',
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        });
        if (!res.ok) {
          const bodyText = await res.text();
          const ra = res.headers.get('retry-after');
          const retryAfterSec = ra ? Number(ra) : undefined;
          throw new HttpJsonError(res.status, bodyText, url, retryAfterSec);
        }
        if (res.status === 204) return null;
        const ct = res.headers.get('content-type') ?? '';
        return ct.includes('application/json') ? res.json() : res.text();
      },
      policy,
      (err) => {
        if (!(err instanceof HttpJsonError)) return 'retry';
        // 4xx (except 408/425/429) are not retryable.
        if (err.status >= 400 && err.status < 500 && ![408, 425, 429].includes(err.status)) return 'fail';
        return 'retry';
      },
    );
  }

  async requestParsed<T>(schema: ZodType<T>, path: string, opts: RequestOptions = {}): Promise<T> {
    const raw = await this.requestRaw(path, opts);
    return schema.parse(raw);
  }

  /** Cursor-pagination helper. Provider-specific extraction lives in the caller. */
  async *paginate<T>(
    schema: ZodType<T>,
    path: string,
    opts: { extractItems: (page: unknown) => T[]; extractNext: (page: unknown) => string | null } & RequestOptions,
  ): AsyncIterable<T[]> {
    let next: string | null = path;
    while (next) {
      const page = await this.requestRaw(next, opts);
      const items = opts.extractItems(page).map((it) => schema.parse(it));
      yield items;
      next = opts.extractNext(page);
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const base = this.cfg.baseUrl.replace(/\/+$/, '');
    const p = path.startsWith('http') ? path : `${base}/${path.replace(/^\/+/, '')}`;
    if (!query) return p;
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return qs ? `${p}${p.includes('?') ? '&' : '?'}${qs}` : p;
  }
}
