/**
 * everything-search contracts. A unified search port over the Windows
 * Everything index (with fd/ripgrep fallback). Events let other capabilities
 * observe query traffic and index refreshes without scraping logs.
 */
import { z } from 'zod';

export const SearchHitSchema = z.object({
  path: z.string(),
  /** Basename of the path, surfaced for ranking and display. */
  name: z.string(),
  /** File extension without dot, lowercased ('pdf', 'mp4', ...). */
  ext: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
  modifiedAt: z.string().datetime().optional(),
  /** Volume / drive letter or mount root the hit came from. */
  volume: z.string().optional(),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const SearchQueryReceivedEvent = z.object({
  event: z.literal('search.query.received'),
  queryId: z.string().uuid(),
  query: z.string(),
  /** Which backend served this query. */
  backend: z.enum(['everything-http', 'everything-cli', 'fd', 'ripgrep']),
  /** Host the query ran on (fleet-control routes per-host). */
  host: z.string(),
  filters: z.object({
    extensions: z.array(z.string()).optional(),
    volumes: z.array(z.string()).optional(),
    limit: z.number().int().positive().optional(),
  }).default({}),
  at: z.string().datetime(),
});
export type SearchQueryReceived = z.infer<typeof SearchQueryReceivedEvent>;

export const SearchResultsDeliveredEvent = z.object({
  event: z.literal('search.results.delivered'),
  queryId: z.string().uuid(),
  hitCount: z.number().int().nonnegative(),
  /** A small sample for downstream logging; full results stream over the API. */
  sample: z.array(SearchHitSchema).max(10),
  wallMs: z.number().int().nonnegative(),
  /** True when the underlying backend truncated results before returning. */
  truncated: z.boolean(),
});
export type SearchResultsDelivered = z.infer<typeof SearchResultsDeliveredEvent>;

export const SearchIndexerRefreshedEvent = z.object({
  event: z.literal('search.indexer.refreshed'),
  host: z.string(),
  backend: z.enum(['everything-http', 'everything-cli', 'fd', 'ripgrep']),
  filesIndexed: z.number().int().nonnegative().optional(),
  wallMs: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type SearchIndexerRefreshed = z.infer<typeof SearchIndexerRefreshedEvent>;

export const EVENT_NAMES = {
  queryReceived: 'search.query.received',
  resultsDelivered: 'search.results.delivered',
  indexerRefreshed: 'search.indexer.refreshed',
} as const;
