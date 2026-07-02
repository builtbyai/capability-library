/**
 * product-intelligence canonical shapes.
 *
 * This is the **L1 canonical product / supplier / pain-point shape that every
 * downstream MJB capability depends on** (~40 of the 102 MJB primitives consume
 * one of these). Per CLAUDE.md's "decide contracts first" rule, NOTHING in
 * the MJB commerce pipeline should invent its own product/supplier object —
 * everything reads from or normalizes into the schemas defined here:
 *
 *   - `ProductCandidateSchema`    — every external source family produces this
 *   - `PainPointSchema`           — Reddit / TikTok organic / Amazon review mining output
 *   - `SupplierCandidateSchema`   — AliExpress / 1688 / Taobao / CSSBuy / manual entries
 *
 * `rawSnapshot` on every shape is the verbatim provider response, kept so
 * normalization can be re-run without re-fetching (and so we can switch
 * adapter providers later without losing existing data).
 *
 * Downstream consumers (non-exhaustive):
 *   product-registry   ← product.candidate.discovered → canonical product JSON
 *   product-scoring    ← product.candidate.enriched   → 8-category scorecard
 *   ugc-concept-engine ← pain-point.captured + comment.captured → hooks/scripts
 *   performance-loop   ← review-text.captured (joins to comment objection bank)
 */
import { z } from 'zod';

/** Every external data source product-intelligence talks to. */
export const SourceFamily = z.enum([
  'tiktok-shop',
  'tiktok-organic',
  'amazon',
  'instagram',
  'reddit',
  'aliexpress',
  '1688',
  'taobao',
  'cssbuy',
  'trends',
]);
export type SourceFamily = z.infer<typeof SourceFamily>;

/** Media reference attached to a candidate. Files upload via intake-pipeline. */
export const MediaRefSchema = z.object({
  kind: z.enum(['image', 'video', 'doc']),
  /** Populated once the bytes have been uploaded via intake-pipeline. */
  intakeObjectId: z.string().optional(),
  /** Original provider URL — kept even after intake upload for traceability. */
  sourceUrl: z.string().url(),
});
export type MediaRef = z.infer<typeof MediaRefSchema>;

/** Lightweight supplier hint embedded in a ProductCandidate when the source
 *  doubles as a supplier directory (AliExpress / 1688 / Taobao listings).
 *  For dedicated supplier rows, see `SupplierCandidateSchema`. */
export const SupplierHintSchema = z.object({
  name: z.string().optional(),
  region: z.string().optional(),
  ratingPct: z.number().min(0).max(100).optional(),
  moq: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
});
export type SupplierHint = z.infer<typeof SupplierHintSchema>;

/** Per-post / per-listing engagement signals. Sparse by design — different
 *  source families populate different fields. */
export const SocialSignalsSchema = z.object({
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  /** Often estimated from share counters or reach diff; mark as float. */
  sharesEstimate: z.number().nonnegative().optional(),
});
export type SocialSignals = z.infer<typeof SocialSignalsSchema>;

/** Aggregate review summary. Full review bodies travel as `review-text.captured`
 *  events to keep this shape compact. */
export const ReviewSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  avgRating: z.number().min(0).max(5),
  topPositive: z.array(z.string()).default([]),
  topNegative: z.array(z.string()).default([]),
});
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;

/**
 * The canonical shape every adapter emits. Designed to be a strict superset
 * of what each of the 10 source families can produce, so downstream caps
 * never need source-specific code paths.
 */
export const ProductCandidateSchema = z.object({
  id: z.string().uuid(),
  source: SourceFamily,
  /** Provider-side id (asin, item_id, tiktok product id, reddit post id, ...). */
  sourceId: z.string(),
  discoveredAt: z.string().datetime(),
  name: z.string(),
  description: z.string().default(''),
  priceUsd: z.number().nonnegative().optional(),
  currencyOriginal: z.string().length(3).optional(),
  priceOriginal: z.number().nonnegative().optional(),
  /** Canonical URLs back to the source (product page, post page, listing). */
  urls: z.array(z.string().url()).default([]),
  mediaRefs: z.array(MediaRefSchema).default([]),
  supplierHint: SupplierHintSchema.optional(),
  socialSignals: SocialSignalsSchema.optional(),
  reviewSummary: ReviewSummarySchema.optional(),
  /** Free Record keyed by provider-id; e.g. competitor ASIN comparisons,
   *  TikTok Shop offer structures, IG branded-content tags. Normalized later
   *  by product-scoring / product-registry. */
  competitiveContext: z.record(z.unknown()).optional(),
  /** Verbatim provider response. Re-extraction without re-fetching. */
  rawSnapshot: z.record(z.unknown()).default({}),
});
export type ProductCandidate = z.infer<typeof ProductCandidateSchema>;

/**
 * Buyer-language extracted from Reddit threads, TikTok organic comments,
 * Amazon reviews. Distinct from the aggregated `ReviewSummary` because a
 * pain-point is the actionable phrase (feeds ugc-concept-engine's objection
 * library), not a roll-up metric.
 */
export const PainPointSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['reddit', 'tiktok-organic', 'amazon-review', 'other']),
  discoveredAt: z.string().datetime(),
  /** Niche slug — pet, home-gadgets, fashion-accessories, etc. */
  niche: z.string(),
  /** The pain-point phrase itself. */
  text: z.string(),
  /** Parent post / comment / review text for context. */
  context: z.string().default(''),
  /** Defensible inference of urgency / strength of expressed need.
   *  Optional — adapters that can't score it leave it undefined. */
  urgencyScore: z.number().min(0).max(1).optional(),
});
export type PainPoint = z.infer<typeof PainPointSchema>;

/**
 * A dedicated supplier row (vs. the embedded `supplierHint` on a ProductCandidate).
 * Populated by AliExpress / 1688 / Taobao / CSSBuy adapters when their
 * `lookup(productCandidateId)` method finds matching supplier listings.
 */
export const SupplierCandidateSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(['aliexpress', '1688', 'taobao', 'cssbuy', 'manual']),
  supplierName: z.string(),
  region: z.string(),
  ratingPct: z.number().min(0).max(100).optional(),
  moq: z.number().int().nonnegative().optional(),
  leadTimeDays: z.number().int().nonnegative().optional(),
  pricePerUnitUsd: z.number().nonnegative(),
  /** Confidence that this supplier actually sells the upstream ProductCandidate
   *  (image hash match + title similarity + spec-match heuristics). 0..1. */
  productMatchConfidence: z.number().min(0).max(1),
  urls: z.array(z.string().url()).default([]),
  rawSnapshot: z.record(z.unknown()).default({}),
});
export type SupplierCandidate = z.infer<typeof SupplierCandidateSchema>;
