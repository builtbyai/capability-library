import type { ReplicateClient } from './replicate.client.js';
import {
  Prediction,
  type Paginated,
  type WebhookEvent,
} from '../contracts/schemas.js';

export interface CreatePredictionInput {
  /**
   * Either `{owner}/{name}`, `{owner}/{name}:{version_id}`, or just
   * `{version_id}`. Official models accept the bare `{owner}/{name}` form.
   */
  version: string;
  input: Record<string, unknown>;
  webhook?: string;
  webhook_events_filter?: WebhookEvent[];
  /** Deprecated by Replicate — `urls.stream` is always present when supported. */
  stream?: boolean;
}

export interface CreatePredictionOptions {
  /** Sync mode (1-60 seconds). Reply may still come back `starting`. */
  waitSeconds?: number;
  cancelAfter?: string;
}

export interface ListPredictionsQuery {
  created_after?: string;
  created_before?: string;
  /** Currently only `web` is supported by the API. */
  source?: 'web';
}

export class PredictionsService {
  constructor(private readonly client: ReplicateClient) {}

  create(
    body: CreatePredictionInput,
    opts: CreatePredictionOptions = {},
  ): Promise<Prediction> {
    return this.client.requestParsed(Prediction, 'predictions', {
      method: 'POST',
      body,
      waitSeconds: opts.waitSeconds,
      cancelAfter: opts.cancelAfter,
    });
  }

  get(id: string): Promise<Prediction> {
    return this.client.requestParsed(
      Prediction,
      `predictions/${encodeURIComponent(id)}`,
    );
  }

  cancel(id: string): Promise<void> {
    return this.client.request<void>(
      `predictions/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' },
    );
  }

  /** Single page. Use `listAll()` to flatten the cursor walk. */
  async listPage(
    query: ListPredictionsQuery = {},
  ): Promise<Paginated<Prediction>> {
    const raw = await this.client.request<Paginated<unknown>>('predictions', {
      query: query as Record<string, string | undefined>,
    });
    return {
      next: raw.next,
      previous: raw.previous,
      results: raw.results.map((r) => Prediction.parse(r)),
    };
  }

  listAll(query: ListPredictionsQuery = {}): Promise<Prediction[]> {
    return this.client.paginateAll(Prediction, 'predictions', {
      query: query as Record<string, string | undefined>,
    });
  }

  listPages(
    query: ListPredictionsQuery = {},
  ): AsyncGenerator<Prediction[], void, void> {
    return this.client.paginate(Prediction, 'predictions', {
      query: query as Record<string, string | undefined>,
    });
  }

  /**
   * Convenience: poll until the prediction reaches a terminal status.
   * Intervals back off from `initialIntervalMs` to `maxIntervalMs`.
   */
  async waitForCompletion(
    id: string,
    opts: {
      initialIntervalMs?: number;
      maxIntervalMs?: number;
      timeoutMs?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<Prediction> {
    const start = Date.now();
    const initial = opts.initialIntervalMs ?? 1000;
    const max = opts.maxIntervalMs ?? 5000;
    const timeout = opts.timeoutMs ?? 30 * 60_000;
    let delay = initial;
    while (true) {
      if (opts.signal?.aborted) throw new Error('aborted');
      const p = await this.get(id);
      if (
        p.status === 'succeeded' ||
        p.status === 'failed' ||
        p.status === 'canceled'
      ) {
        return p;
      }
      if (Date.now() - start > timeout) {
        throw new Error(
          `Timed out waiting for prediction ${id} (last status: ${p.status})`,
        );
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(max, Math.round(delay * 1.4));
    }
  }
}
