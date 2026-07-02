/**
 * reddit adapter port.
 *
 * MJB primitive covered: 5 (mine Reddit niche threads for pain points,
 * buyer objections, demand language). This adapter is the primary `PainPoint`
 * source — `scan()` returns ProductCandidates only when a thread explicitly
 * mentions a product; the high-value output is the
 * `pain-point.captured` event stream that flows into ugc-concept-engine.
 *
 * TOS risk profile: MEDIUM. Reddit's official API is rate-limited (since
 * 2023's policy change) but does not flip into bot-detection like
 * TikTok/Amazon — it just hard-throttles. Auth + a user-agent header is
 * required; OAuth flow is the only way to get production-grade rate limits.
 *
 * Known-provider research candidates (NOT contracts):
 *   — Official: Reddit Data API (data.reddit.com) — OAuth-gated, generous
 *     for non-commercial, expensive for commercial. The right primary path.
 *   — RapidAPI: "Reddit Scraper Lite", "Reddit34" — useful as a backup when
 *     OAuth limits are saturated.
 *   — Fallback: old.reddit.com HTML scrape (works without auth but very
 *     limited).
 */
import type { ProductCandidate, PainPoint } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type RedditAdapterKind = AdapterKind;

export interface RedditScanParams {
  /** Subreddit name without /r/ prefix. */
  subreddit?: string;
  /** Full-text query (relevance / hot / new sorting). */
  query?: string;
  niche?: string;
  /** Threads marked as questions / complaints are richer pain-point sources. */
  flair?: string;
  cursor?: string;
  limit?: number;
}

export interface RedditLookupParams {
  /** Post id (t3_xxxxx), permalink, or full reddit.com URL. */
  ref: string;
}

export type RedditHealth = AdapterHealth;

export interface RedditAdapterPort {
  id: string;
  kind: RedditAdapterKind;
  scan(params: RedditScanParams): Promise<AdapterResult<{ candidates: ProductCandidate[]; painPoints: PainPoint[] }>>;
  lookup(params: RedditLookupParams): Promise<AdapterResult<ProductCandidate>>;
  enrich(productCandidateId: string, options?: { withComments?: boolean }): Promise<AdapterResult<Partial<ProductCandidate>>>;
  /** Top-level comments on a thread — the raw substrate for pain-point mining. */
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  /** Reddit has no "reviews"; omitted from the port shape. Implementations
   *  may still expose a no-op for cross-source symmetry. */
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  healthCheck(): Promise<RedditHealth>;
}
