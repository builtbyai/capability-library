import { z } from 'zod';
import {
  ReplicateClientConfigSchema,
  type ReplicateClientConfig,
  type ResolvedReplicateClientConfig,
} from '../contracts/config.schema.js';
import { Paginated } from '../contracts/schemas.js';

export class ReplicateApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly url: string,
    readonly method: string,
  ) {
    super(message);
    this.name = 'ReplicateApiError';
  }
}

export interface CallOptions {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Sync mode: leave the request open for up to N seconds (1-60). */
  waitSeconds?: number;
  /** Server-side cancellation deadline. e.g. '30s', '5m', '1h30m'. >= 5s. */
  cancelAfter?: string;
  /** Extra headers to merge in. */
  headers?: Record<string, string>;
  /** Raw text body — bypasses JSON serialization (used by QUERY search). */
  rawTextBody?: string;
  contentType?: string;
}

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export class ReplicateClient {
  readonly config: ResolvedReplicateClientConfig;
  private readonly fetcher: Fetcher;

  constructor(config: ReplicateClientConfig) {
    this.config = ReplicateClientConfigSchema.parse(config);
    const f = this.config.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error(
        'No fetch implementation available. Pass `fetch` in config or run on Node 18+.',
      );
    }
    this.fetcher = f as Fetcher;
  }

  /**
   * Low-level request. Returns parsed JSON for 2xx responses, or throws
   * ReplicateApiError. Retries 429 honouring `Retry-After`, up to maxRetries.
   */
  async request<T>(path: string, opts: CallOptions = {}): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const method = opts.method ?? 'GET';
    const headers = this.buildHeaders(opts);

    let body: BodyInit | undefined;
    if (opts.rawTextBody !== undefined) {
      body = opts.rawTextBody;
    } else if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
    }

    for (let attempt = 0; ; attempt++) {
      const res = await this.fetcher(url, { method, headers, body });

      if (res.status === 429 && attempt < this.config.maxRetries) {
        const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
        await sleep(retryAfter);
        continue;
      }

      if (res.status === 204 || res.status === 202) {
        return undefined as T;
      }

      const text = await res.text();
      const parsed = text ? safeJson(text) : undefined;

      if (!res.ok) {
        throw new ReplicateApiError(
          `Replicate ${method} ${path} -> ${res.status} ${res.statusText}`,
          res.status,
          parsed ?? text,
          url,
          method,
        );
      }

      return (parsed as T) ?? (undefined as T);
    }
  }

  /** Parse + validate the JSON response against a zod schema. */
  async requestParsed<S extends z.ZodTypeAny>(
    schema: S,
    path: string,
    opts: CallOptions = {},
  ): Promise<z.infer<S>> {
    const raw = await this.request<unknown>(path, opts);
    return schema.parse(raw);
  }

  /**
   * Walk a paginated endpoint via the `next` cursor URL. Yields one validated
   * page at a time so callers can paginate lazily.
   */
  async *paginate<S extends z.ZodTypeAny>(
    itemSchema: S,
    path: string,
    opts: CallOptions = {},
  ): AsyncGenerator<z.infer<S>[], void, void> {
    const pageSchema = Paginated(itemSchema);
    let url: string | null = this.buildUrl(path, opts.query);
    let first = true;
    while (url) {
      const headers = this.buildHeaders(first ? opts : {});
      const res = await this.fetcher(url, { method: 'GET', headers });
      const text = await res.text();
      const parsed = text ? safeJson(text) : undefined;
      if (!res.ok) {
        throw new ReplicateApiError(
          `Replicate GET ${path} -> ${res.status} ${res.statusText}`,
          res.status,
          parsed ?? text,
          url,
          'GET',
        );
      }
      const page = pageSchema.parse(parsed);
      yield page.results;
      url = page.next;
      first = false;
    }
  }

  /** Drain `.paginate(...)` into a single array. */
  async paginateAll<S extends z.ZodTypeAny>(
    itemSchema: S,
    path: string,
    opts: CallOptions = {},
  ): Promise<z.infer<S>[]> {
    const out: z.infer<S>[] = [];
    for await (const batch of this.paginate(itemSchema, path, opts)) {
      out.push(...batch);
    }
    return out;
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const full = path.startsWith('http')
      ? path
      : `${base}/${path.replace(/^\//, '')}`;
    if (!query) return full;
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      usp.set(k, String(v));
    }
    const qs = usp.toString();
    if (!qs) return full;
    return full + (full.includes('?') ? '&' : '?') + qs;
  }

  private buildHeaders(opts: CallOptions): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
      Accept: 'application/json',
      'User-Agent': this.config.userAgent,
    };
    if (opts.rawTextBody !== undefined) {
      h['Content-Type'] = opts.contentType ?? 'text/plain';
    } else if (opts.body !== undefined) {
      h['Content-Type'] = opts.contentType ?? 'application/json';
    }
    if (opts.waitSeconds !== undefined) {
      const n = clamp(opts.waitSeconds, 1, 60);
      h['Prefer'] = `wait=${n}`;
    }
    if (opts.cancelAfter !== undefined) {
      h['Cancel-After'] = opts.cancelAfter;
    }
    if (opts.headers) Object.assign(h, opts.headers);
    return h;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseRetryAfter(header: string | null): number {
  if (!header) return 1000;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(60_000, Math.max(250, Math.round(seconds * 1000)));
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.min(60_000, Math.max(250, date - Date.now()));
  }
  return 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
