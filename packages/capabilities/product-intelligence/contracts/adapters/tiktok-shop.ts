/**
 * tiktok-shop adapter port.
 *
 * MJB primitives covered: 1 (scrape TikTok Shop trending product listings),
 * 12 (read TikTok Shop pricing + offer structure).
 *
 * TOS risk profile: HIGH. TikTok Shop has no public scrape API; every adapter
 * lives on borrowed time. Rotates UA + proxy. RapidAPI providers exist but
 * vary in coverage. Expect `bot-detected` rejections in bursts; honor the
 * runtime auto-pause when this happens.
 *
 * Known-provider research candidates (NOT contracts — see
 * `kb/rapidapi-research.md` for the visit-count seed):
 *   — RapidAPI: no single dominant provider for TikTok Shop yet; many
 *     general "TikTok Scraper" providers expose shop endpoints partially.
 *   — Official: TikTok Shop Partner Center API (requires seller account).
 *   — Fallback: Playwright headed scrape behind residential proxy.
 */
import type { ProductCandidate } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type TiktokShopAdapterKind = AdapterKind;

export interface TiktokShopScanParams {
  /** Free-text or category id; whatever the backing provider accepts. */
  query?: string;
  niche?: string;
  /** "Trending products" feed when query is omitted. */
  trending?: boolean;
  /** Provider-specific paging cursor; opaque to callers. */
  cursor?: string;
  limit?: number;
}

export interface TiktokShopLookupParams {
  /** TikTok Shop product id, sku, or canonical URL. */
  ref: string;
}

export type TiktokShopHealth = AdapterHealth;

export interface TiktokShopAdapterPort {
  id: string;
  kind: TiktokShopAdapterKind;
  scan(params: TiktokShopScanParams): Promise<AdapterResult<ProductCandidate[]>>;
  lookup(params: TiktokShopLookupParams): Promise<AdapterResult<ProductCandidate>>;
  enrich(productCandidateId: string, options?: { withReviews?: boolean }): Promise<AdapterResult<Partial<ProductCandidate>>>;
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  healthCheck(): Promise<TiktokShopHealth>;
}
