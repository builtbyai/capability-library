/**
 * amazon adapter port.
 *
 * MJB primitives covered: 3 (scrape Amazon movers / trending products),
 * 11 (benchmark against Amazon competitive listings + reviews).
 *
 * TOS risk profile: HIGH. Amazon flips into bot-detection extremely fast on
 * naive scraping (captcha challenges, IP blocks, "Sorry, something went wrong"
 * walls). RapidAPI providers absorb most of this risk by maintaining their
 * own proxy + UA infrastructure; prefer them over direct scraping in
 * production. Reviews endpoints rate-limit harder than product detail.
 *
 * Known-provider research candidates (from the user's RapidAPI shortlist —
 * see `kb/rapidapi-research.md`; these are starting points for adapter
 * implementations, not contracts):
 *   — "Real-Time Amazon Data" (4 user visits — shortlist)
 *   — "Amazon Online Data API" (4 user visits — shortlist)
 *   — "Amazon Product Info" (3 visits — comparison candidate)
 *   — "Axesso - Amazon Data Service" (3 visits — comparison candidate)
 *   — Official: Amazon SP-API (sellers only; not viable for competitive
 *     intel against listings the operator does not own).
 *   — Fallback: Playwright + residential proxy (last resort).
 */
import type { ProductCandidate } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type AmazonAdapterKind = AdapterKind;

export interface AmazonScanParams {
  /** "Movers & Shakers", "Best Sellers", "New Releases", or custom query. */
  feed?: 'movers' | 'best-sellers' | 'new-releases' | 'search';
  query?: string;
  category?: string;
  marketplace?: 'US' | 'UK' | 'DE' | 'CA' | 'AU' | string;
  cursor?: string;
  limit?: number;
}

export interface AmazonLookupParams {
  /** ASIN or full Amazon product URL. */
  ref: string;
  marketplace?: string;
}

export type AmazonHealth = AdapterHealth;

export interface AmazonAdapterPort {
  id: string;
  kind: AmazonAdapterKind;
  scan(params: AmazonScanParams): Promise<AdapterResult<ProductCandidate[]>>;
  lookup(params: AmazonLookupParams): Promise<AdapterResult<ProductCandidate>>;
  enrich(productCandidateId: string, options?: { withReviews?: boolean; withCompetitive?: boolean }): Promise<AdapterResult<Partial<ProductCandidate>>>;
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  /** Amazon has no "comments" surface; method intentionally omitted from
   *  the port shape. Adapters can still implement it as a no-op if a
   *  unified caller wants symmetry across sources. */
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  healthCheck(): Promise<AmazonHealth>;
}
