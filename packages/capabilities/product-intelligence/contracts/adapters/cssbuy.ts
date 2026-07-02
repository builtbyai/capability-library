/**
 * cssbuy adapter port.
 *
 * MJB primitive covered: 9 (lookup CSSBuy / agent-purchasing source links).
 * CSSBuy is a CN buying-agent service that takes a Taobao/1688/Weidian URL
 * and returns a unified purchase link with consolidated international
 * shipping. The adapter's role here is link-translation + estimated agent
 * fee surfacing, NOT primary product discovery.
 *
 * TOS risk profile: MEDIUM (intermittent). CSSBuy itself is a smaller
 * platform and is sometimes briefly down / rate-limiting. It does not have
 * the same anti-bot posture as Amazon/TikTok, but uptime is the dominant
 * risk. Treat transient failures as expected; the runtime should fall back
 * to surfacing the original Taobao/1688 URL with a "no agent quote
 * available" flag rather than blocking the workflow.
 *
 * Known-provider research candidates (NOT contracts):
 *   — Official: CSSBuy has no public API; URL-transform is structural
 *     (cssbuy.com/item-<id>.html derived from upstream item id).
 *   — Adjacent agents: Superbuy, Pandabuy, Hoobuy — same pattern; consider
 *     a sibling adapter file per agent if the workflow needs price-shopping
 *     across agents.
 */
import type { SupplierCandidate } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type CssbuyAdapterKind = AdapterKind;

export interface CssbuyScanParams {
  /** CSSBuy does not really have a "discovery" surface — `scan` is a
   *  pass-through that returns agent-link variants for a known URL. Most
   *  callers will use `lookup` instead. */
  upstreamUrl: string;
}

export interface CssbuyLookupParams {
  /** A Taobao / 1688 / Weidian URL or item id. The adapter returns an
   *  agent-purchase SupplierCandidate (cssbuy URL + estimated agent fee
   *  + estimated international shipping bracket). */
  upstreamUrl: string;
}

export type CssbuyHealth = AdapterHealth;

export interface CssbuyAdapterPort {
  id: string;
  kind: CssbuyAdapterKind;
  scan(params: CssbuyScanParams): Promise<AdapterResult<SupplierCandidate[]>>;
  lookup(params: CssbuyLookupParams): Promise<AdapterResult<SupplierCandidate>>;
  enrich(productCandidateId: string, options?: { withShippingEstimate?: boolean }): Promise<AdapterResult<Partial<SupplierCandidate>>>;
  /** No reviews / comments surface on CSSBuy. */
  getReviews?(productId: string): Promise<AdapterResult<Array<{ id: string; rating?: number; text: string }>>>;
  getComments?(postId: string): Promise<AdapterResult<Array<{ id: string; author?: string; text: string }>>>;
  healthCheck(): Promise<CssbuyHealth>;
}
