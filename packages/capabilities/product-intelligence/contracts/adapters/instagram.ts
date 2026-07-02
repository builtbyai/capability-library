/**
 * instagram adapter port.
 *
 * MJB primitive covered: 4 (scrape Instagram product pages — branded
 * content, shop tags, creator product feeds).
 *
 * TOS risk profile: HIGH. Meta's anti-scrape posture is aggressive; even
 * logged-in API access (Graph API) is heavily gated and only available for
 * approved business use cases. Public/anonymous scraping hits captcha walls
 * and account flagging fast. Honor the runtime auto-pause.
 *
 * Known-provider research candidates (NOT contracts):
 *   — RapidAPI: "Instagram Scraper", "Instagram Bulk Profile Scrapper",
 *     "Instagram Looter" — coverage is profile/post oriented; shop endpoints
 *     are weakest.
 *   — Official: Instagram Graph API (requires app review + business asset
 *     binding; not viable for arbitrary competitor scraping).
 *   — Fallback: Playwright headed scrape (very fragile).
 */
import type { ProductCandidate } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type InstagramAdapterKind = AdapterKind;

export interface InstagramScanParams {
  hashtag?: string;
  /** @handle without the leading @. */
  account?: string;
  /** Scope: profile posts, shop catalog, or reels feed. */
  scope?: 'posts' | 'shop' | 'reels';
  cursor?: string;
  limit?: number;
}

export interface InstagramLookupParams {
  /** Permalink shortcode (e.g. 'C123abcDEF') or full instagram.com URL. */
  ref: string;
}

export type InstagramHealth = AdapterHealth;

export interface InstagramAdapterPort {
  id: string;
  kind: InstagramAdapterKind;
  scan(params: InstagramScanParams): Promise<AdapterResult<ProductCandidate[]>>;
  lookup(params: InstagramLookupParams): Promise<AdapterResult<ProductCandidate>>;
  enrich(productCandidateId: string, options?: { withComments?: boolean }): Promise<AdapterResult<Partial<ProductCandidate>>>;
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  healthCheck(): Promise<InstagramHealth>;
}
