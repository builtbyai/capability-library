import type { ReplicateClient } from './replicate.client.js';
import { SearchModel, type Paginated } from '../contracts/schemas.js';

export interface SearchOptions {
  /** 1-50, defaults to 20 server-side. */
  limit?: number;
}

export class SearchService {
  constructor(private readonly client: ReplicateClient) {}

  /**
   * Beta search across public models, collections, and docs. Currently this
   * client only surfaces the model results — the API response shape for
   * collections/docs is not documented in the public reference.
   */
  async models(
    query: string,
    opts: SearchOptions = {},
  ): Promise<Paginated<import('../contracts/schemas.js').SearchModel>> {
    const raw = await this.client.request<Paginated<unknown>>('search', {
      query: { query, limit: opts.limit },
    });
    return {
      next: raw.next,
      previous: raw.previous,
      results: raw.results.map((r) => SearchModel.parse(r)),
    };
  }

  /** Raw, untyped passthrough — for callers that need collections/docs results. */
  raw(
    query: string,
    opts: SearchOptions = {},
  ): Promise<Record<string, unknown>> {
    return this.client.request<Record<string, unknown>>('search', {
      query: { query, limit: opts.limit },
    });
  }
}
