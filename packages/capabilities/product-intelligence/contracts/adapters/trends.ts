/**
 * trends adapter port.
 *
 * MJB primitive covered: 14 (pull hashtag + niche category trend signals —
 * pet, home gadgets, fashion accessories, impulse-buy items). Distinct from
 * `tiktok-organic` because trends adapters return aggregate signals
 * (hashtag growth rate, category velocity) NOT specific posts. Feeds
 * product-scoring's "demand" axis and product-intelligence's scan-source
 * prioritization (high-growth hashtag -> scan tiktok-organic / tiktok-shop
 * for that hashtag next).
 *
 * TOS risk profile: LOW-MEDIUM. Most trends sources are first-party
 * dashboards (Google Trends, TikTok Creative Center, Exploding Topics) that
 * have stable scrape paths or formal APIs. Bot-detection is rare; the more
 * common failure is `no-results` for niches the source doesn't cover.
 *
 * Known-provider research candidates (NOT contracts):
 *   — Google Trends: unofficial libraries (pytrends-equivalent) + scraping.
 *   — TikTok Creative Center: public dashboard, scrape-friendly with
 *     reasonable cadence (do not poll faster than hourly per query).
 *   — Exploding Topics, Glimpse: paid SaaS with structured trend data.
 *   — RapidAPI: "Google Trends API" providers, hashtag analytics providers.
 */
import type { ProductCandidate } from '../product-candidate.js';
import type { AdapterKind, AdapterResult, AdapterHealth } from './_shared.js';

export type TrendsAdapterKind = AdapterKind;

/** A single trend signal — hashtag, category, or topic. */
export interface TrendSignal {
  /** Stable id within the source (hashtag slug, category id, topic id). */
  id: string;
  label: string;
  niche?: string;
  /** Source-specific metrics: views, posts, growth-rate-pct, search-interest. */
  metrics: Record<string, number>;
  /** When the signal was sampled. */
  capturedAt: string;
}

export interface TrendsScanParams {
  /** Optional niche filter; omit to get the global trending feed. */
  niche?: string;
  /** Window length — last 24h / 7d / 30d (provider-mapped). */
  window?: '24h' | '7d' | '30d';
  /** Source platform — google / tiktok / instagram / etc. Defaults to whatever
   *  the adapter implementation natively covers. */
  platform?: string;
  limit?: number;
}

export interface TrendsLookupParams {
  /** Specific hashtag, topic, or search term to fetch detail metrics for. */
  term: string;
  platform?: string;
}

export type TrendsHealth = AdapterHealth;

export interface TrendsAdapterPort {
  id: string;
  kind: TrendsAdapterKind;
  /** Trending hashtag / category feed — returns TrendSignals, NOT product candidates. */
  scan(params: TrendsScanParams): Promise<AdapterResult<TrendSignal[]>>;
  /** Detail probe for one term. */
  lookup(params: TrendsLookupParams): Promise<AdapterResult<TrendSignal>>;
  /** Trends adapters do not enrich ProductCandidates directly; the runtime
   *  uses TrendSignal metrics to weight which `tiktok-organic` /
   *  `tiktok-shop` / `amazon` scan to dispatch NEXT. This stays as a
   *  signature-only method for port-shape symmetry; implementations may
   *  return `{ ok: false, reason: 'no-results' }`. */
  enrich(productCandidateId: string, options?: Record<string, unknown>): Promise<AdapterResult<Partial<ProductCandidate>>>;
  healthCheck(): Promise<TrendsHealth>;
}
