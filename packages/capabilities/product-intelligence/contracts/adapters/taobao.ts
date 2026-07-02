/**
 * taobao adapter port.
 *
 * MJB primitive covered: 8 (lookup Taobao for supplier candidates). Taobao
 * surfaces C2C/small-batch supplier candidates that AliExpress does not
 * cover; pricing is usually lower but the listings are CN-only and require
 * an agent (CSSBuy / Superbuy / etc.) for fulfillment to non-CN buyers.
 *
 * TOS risk profile: MEDIUM-HIGH. Taobao is Alibaba Group infra and has
 * mature anti-scrape. Geo-blocks outside CN are common; many RapidAPI
 * providers proxy through CN endpoints with their own paid infrastructure.
 *
 * Known-provider research candidates (from the user's RapidAPI shortlist —
 * see `kb/rapidapi-research.md`; these are starting points, not contracts):
 *   — "Taobao DataHub" (3 user visits — shortlist)
 *   — "TaoBao® API: Search Items & Shops" (3 visits — shortlist)
 *   — "Taobao 1688 API" (4 visits — shortlist; covers both Taobao + 1688)
 *   — Official: Taobao Open Platform / Alibaba Open API (requires CN
 *     business entity; not a viable primary path for solo operators).
 *   — Fallback: Playwright with CN-region proxy.
 */
import type { ProductCandidate, SupplierCandidate } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type TaobaoAdapterKind = AdapterKind;

export interface TaobaoScanParams {
  query?: string;
  category?: string;
  sort?: 'sales' | 'price_asc' | 'price_desc' | 'rating';
  cursor?: string;
  limit?: number;
}

export interface TaobaoLookupParams {
  text?: string;
  imageUrl?: string;
  productCandidateId?: string;
  limit?: number;
}

export type TaobaoHealth = AdapterHealth;

export interface TaobaoAdapterPort {
  id: string;
  kind: TaobaoAdapterKind;
  scan(params: TaobaoScanParams): Promise<AdapterResult<ProductCandidate[]>>;
  lookup(params: TaobaoLookupParams): Promise<AdapterResult<SupplierCandidate[]>>;
  enrich(productCandidateId: string, options?: { withReviews?: boolean }): Promise<AdapterResult<Partial<ProductCandidate>>>;
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  healthCheck(): Promise<TaobaoHealth>;
}
