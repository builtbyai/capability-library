/**
 * tiktok-organic adapter port.
 *
 * MJB primitive covered: 2 (scrape TikTok organic product videos + comments).
 * Distinct from `tiktok-shop` because organic posts have no SKU / price /
 * offer structure; they produce social signals + comment language (buyer
 * objections feed ugc-concept-engine + product-scoring's review summary).
 *
 * TOS risk profile: VERY HIGH. TikTok aggressively challenges scrapers on
 * organic feeds (fingerprinting, captcha, account suspension). Burst
 * detection is the norm; expect `bot-detected` within minutes of a naive
 * polling pattern. Throttle hard, rotate identities, and treat the
 * `tos.bot-detection.triggered` auto-pause as routine.
 *
 * Known-provider research candidates (NOT contracts):
 *   — RapidAPI: "TikTok All in One", "TikTok Scraper", "TikTok Video No
 *     Watermark" — coverage varies, comment endpoints are spotty.
 *   — Unofficial: tikapi.io, tiktokapi.online (third-party SaaS wrappers).
 *   — Fallback: Playwright headed scrape behind residential proxy (slow,
 *     fragile, but unblocks niche queries no provider covers).
 */
import type { ProductCandidate } from '../product-candidate.js';
import type { AdapterResult, AdapterHealth } from './_shared.js';

/** Note: organic TikTok has no official API path — kept narrower than the
 *  shared AdapterKind on purpose. */
export type TiktokOrganicAdapterKind = 'rapidapi' | 'scrape-browser' | 'scrape-http';

export interface TiktokOrganicScanParams {
  /** Hashtag or keyword. At least one must be set. */
  hashtag?: string;
  keyword?: string;
  niche?: string;
  /** Caps minimum view-count or recency to limit noise. */
  minViews?: number;
  maxAgeDays?: number;
  cursor?: string;
  limit?: number;
}

export interface TiktokOrganicLookupParams {
  /** TikTok video id, share URL, or @handle/video/<id> path. */
  ref: string;
}

export type TiktokOrganicHealth = AdapterHealth;

export interface TiktokOrganicAdapterPort {
  id: string;
  kind: TiktokOrganicAdapterKind;
  scan(params: TiktokOrganicScanParams): Promise<AdapterResult<ProductCandidate[]>>;
  lookup(params: TiktokOrganicLookupParams): Promise<AdapterResult<ProductCandidate>>;
  enrich(productCandidateId: string, options?: { withComments?: boolean; commentLimit?: number }): Promise<AdapterResult<Partial<ProductCandidate>>>;
  /** Organic posts have no formal "reviews", but adapter implementations
   *  may bucket high-signal long-form comments as pseudo-reviews. */
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  healthCheck(): Promise<TiktokOrganicHealth>;
}
