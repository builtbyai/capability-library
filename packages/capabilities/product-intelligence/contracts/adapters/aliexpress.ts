/**
 * aliexpress adapter port.
 *
 * MJB primitive covered: 6 (lookup AliExpress for supplier candidates — unit
 * cost, MOQ, shipping). This is the most common supplier-discovery surface
 * for English-speaking dropship operators; usually the first lookup target
 * once a ProductCandidate from TikTok/Amazon has been triaged.
 *
 * TOS risk profile: MEDIUM. AliExpress is more tolerant than Amazon but
 * still IP-throttles and has region-specific rate limits. RapidAPI providers
 * absorb most risk. Affiliate-program API (Aliexpress Open Platform) exists
 * but requires approval and is targeted at commission-link workflows.
 *
 * Known-provider research candidates (NOT contracts):
 *   — RapidAPI: "AliExpress DataHub", "Aliexpress True API",
 *     "Aliexpress Datahub by Algopix" — coverage varies, image-search
 *     endpoints are often premium-tier.
 *   — Official: AliExpress Open Platform (affiliate program; partial fit).
 *   — Fallback: Playwright (slow; geo-fenced for some categories).
 */
import type { ProductCandidate, SupplierCandidate } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type AliExpressAdapterKind = AdapterKind;

export interface AliExpressScanParams {
  query?: string;
  category?: string;
  /** Sort: orders / price_asc / price_desc / new — provider-mapped. */
  sort?: 'orders' | 'price_asc' | 'price_desc' | 'new';
  cursor?: string;
  limit?: number;
}

export interface AliExpressLookupParams {
  /** Either a free-text product description, an image URL, or an upstream
   *  ProductCandidate id whose image+name to image-search by. */
  text?: string;
  imageUrl?: string;
  productCandidateId?: string;
  limit?: number;
}

export type AliExpressHealth = AdapterHealth;

export interface AliExpressAdapterPort {
  id: string;
  kind: AliExpressAdapterKind;
  /** "Trending listings" by category — produces ProductCandidates. */
  scan(params: AliExpressScanParams): Promise<AdapterResult<ProductCandidate[]>>;
  /** Image / text supplier search — produces SupplierCandidates keyed to an
   *  upstream ProductCandidate. This is the dominant use mode. */
  lookup(params: AliExpressLookupParams): Promise<AdapterResult<SupplierCandidate[]>>;
  enrich(productCandidateId: string, options?: { withReviews?: boolean }): Promise<AdapterResult<Partial<ProductCandidate>>>;
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  /** AliExpress Q&A could feed here in future; omitted from default port. */
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  healthCheck(): Promise<AliExpressHealth>;
}
