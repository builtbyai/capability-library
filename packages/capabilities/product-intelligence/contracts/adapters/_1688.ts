/**
 * 1688 adapter port. (Filename uses a leading underscore because TS module
 * names cannot start with a digit; the runtime `id` is `'1688'`.)
 *
 * MJB primitive covered: 7 (lookup 1688 for lower-cost source). 1688.com is
 * Alibaba's CN wholesale marketplace — prices are typically 30-60% lower
 * than AliExpress for the same item, but listings are CN-only, MOQs are
 * meaningful, and fulfillment requires an agent (CSSBuy / Superbuy / a CN
 * sourcing partner).
 *
 * TOS risk profile: VERY HIGH. 1688 has the most aggressive anti-scrape of
 * any source in this catalog — paid RapidAPI providers are essentially the
 * only viable path for non-CN operators. Direct scraping from non-CN IPs
 * is almost immediately captcha-walled. Honor the auto-pause aggressively.
 *
 * Known-provider research candidates (from the user's RapidAPI shortlist —
 * see `kb/rapidapi-research.md`; these are starting points, not contracts):
 *   — "Taobao 1688 API" (4 user visits — shortlist; covers both 1688 +
 *     Taobao, often the path of least resistance).
 *   — Official: 1688 Open Platform (CN business entity required; not
 *     viable for solo operators).
 *   — Fallback: NOT recommended — Playwright through residential CN proxy
 *     is fragile and gets the proxy blocked quickly.
 */
import type { ProductCandidate, SupplierCandidate } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type _1688AdapterKind = AdapterKind;

export interface _1688ScanParams {
  query?: string;
  category?: string;
  /** Sort knob — provider-mapped. */
  sort?: 'volume' | 'price_asc' | 'price_desc' | 'rating';
  cursor?: string;
  limit?: number;
}

export interface _1688LookupParams {
  text?: string;
  imageUrl?: string;
  productCandidateId?: string;
  /** MOQ filter — only return suppliers willing to sell <= this quantity. */
  maxMoq?: number;
  limit?: number;
}

export type _1688Health = AdapterHealth;

export interface _1688AdapterPort {
  id: string;
  kind: _1688AdapterKind;
  scan(params: _1688ScanParams): Promise<AdapterResult<ProductCandidate[]>>;
  lookup(params: _1688LookupParams): Promise<AdapterResult<SupplierCandidate[]>>;
  enrich(productCandidateId: string, options?: { withReviews?: boolean }): Promise<AdapterResult<Partial<ProductCandidate>>>;
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  healthCheck(): Promise<_1688Health>;
}
