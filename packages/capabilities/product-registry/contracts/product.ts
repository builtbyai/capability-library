/**
 * product-registry canonical shapes.
 *
 * **THIS IS THE L1 CANONICAL PRODUCT SHAPE FOR THE MJB COMMERCE PIPELINE.**
 *
 * ~40 of the 102 MJB primitives depend on the `ProductSchema` declared in
 * this file. Per CLAUDE.md's "decide contracts first" rule, NO downstream
 * MJB capability should invent its own product object — product-scoring,
 * ugc-concept-engine, funnel-builder, performance-loop, social-distribution,
 * and content-dashboard all read from or write into the shape declared here.
 *
 * Field changes to `ProductSchema` are BREAKING and require bumping
 * `schemaVersion` (primitive 19 implies long-term shape evolution, and
 * primitive 92's month-over-month decision-state diffs depend on historical
 * shapes remaining replayable).
 *
 * Relation to upstream `ProductCandidate`:
 *   - A `ProductCandidate` is the raw, source-attributed signal emitted by
 *     product-intelligence (TikTok Shop, Amazon, IG, Reddit, AliExpress, ...).
 *   - A `Product` is the registered, lifecycle-stateful entity created when
 *     product-registry accepts a candidate (after dedupe-check). One Product
 *     may have been discovered from many candidates (`sources[]`); a
 *     candidate that loses dedupe never becomes a Product (it emits
 *     `product.candidate.rejected` with reason='duplicate').
 *
 * Sibling files in this folder:
 *   - `events.ts`  — typed bus event schemas (registered, updated, lane,
 *                    score-history, archived, consolidated, ...).
 *   - `index.ts`   — barrel re-export.
 */
import { z } from 'zod';

import { SourceFamily } from '../../product-intelligence/contracts/product-candidate.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Identity + classification
 * ──────────────────────────────────────────────────────────────────────── */

/** Stable product id. `prod_` prefix + 12-char base32 short id. Issued by
 *  product-registry on registration; immutable for the life of the product
 *  (consolidation surfaces the merged-from ids in `consolidationHistory`,
 *  but the surviving product keeps its original id). */
export const ProductIdSchema = z.string().regex(/^prod_[a-z0-9]{12}$/);
export type ProductId = z.infer<typeof ProductIdSchema>;

/** Brand-lane assignment. Per MJB primitives 79-80 the lane is the firewall
 *  that prevents private/professional audience bleed across brands. Lane is
 *  assigned post-registration via `POST /api/products/:productId/lane` —
 *  nullable while a product is in `registered`/`enriched` lifecycle state
 *  awaiting operator assignment. */
export const BrandLaneSchema = z.string().regex(/^lane_[a-z0-9_-]+$/);
export type BrandLane = z.infer<typeof BrandLaneSchema>;

/** Business decision state. Per MJB primitives 20 + 92: this is the state
 *  the SCORING and PERFORMANCE feedback loops mutate. It is intentionally
 *  separate from the internal `lifecycleState` so the registry can know that
 *  a product is `live` (lifecycle) while the business has decided to
 *  `KILL` it (decision). */
export const DecisionStateSchema = z.enum([
  'SKIP',
  'WATCH',
  'TEST',
  'BUILD',
  'SCALE',
  'KILL',
  'RETEST',
  'ARCHIVED',
]);
export type DecisionState = z.infer<typeof DecisionStateSchema>;

/** Internal lifecycle state. Tracks what the registry has done with the
 *  product irrespective of any business decision. `draft` is reserved for
 *  manually-entered products that have not yet been validated; auto-created
 *  products from a ProductCandidate start at `registered`. */
export const LifecycleStateSchema = z.enum([
  'draft',
  'registered',
  'enriched',
  'scored',
  'live',
  'paused',
  'archived',
  'consolidated',
]);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Score history (append-only — never overwrite)
 * ──────────────────────────────────────────────────────────────────────── */

/** A single scoring event. Append-only — primitive 21 + 92 require the full
 *  history so month-over-month decision-state diffs are reconstructable and
 *  weekly review packets can show score-trend, not just current score. */
export const ScoreEntrySchema = z.object({
  scoreId: z.string().uuid(),
  productId: ProductIdSchema,
  scoredAt: z.string().datetime(),
  scoredBy: z.enum(['auto', 'manual']),
  /** Capability id that produced the score (e.g. 'product-scoring',
   *  'performance-loop:recompute', or an operator user id for manual). */
  scorer: z.string(),
  /** Scoring algorithm version. Lets the registry render mixed-version
   *  histories without back-filling old scores into the new algorithm. */
  version: z.string(),
  /** The 8-category 1-5 scorecard. Keys are category slugs the scorer
   *  defines (e.g. 'demand', 'margin', 'supplier-confidence', ...). */
  categories: z.record(z.number().min(1).max(5)),
  totalScore: z.number(),
  /** Decision band derived from totalScore. Bands per MJB primitive 21. */
  band: z.enum(['8-18', '19-26', '27-33', '34-40']),
  /** Decision state the scorer *recommended* / set as a result of this
   *  scoring run. Stored on the entry (not just the parent Product) so we
   *  can replay how a product moved between states over time. */
  decisionStateAfter: DecisionStateSchema,
  marginUsd: z.number().optional(),
  supplierConfidence: z.enum(['Low', 'Med', 'High']).optional(),
  notes: z.string().optional(),
});
export type ScoreEntry = z.infer<typeof ScoreEntrySchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Creative-winner notes (per MJB primitive 100)
 * ──────────────────────────────────────────────────────────────────────── */

/** Records the top-performing hook / asset / metric observed inside a
 *  measurement window. Written by `performance-loop` after a test cycle
 *  closes. A product accrues many of these over its lifetime. */
export const CreativeWinnerSchema = z.object({
  recordedAt: z.string().datetime(),
  testWindow: z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }),
  topHook: z.string().optional(),
  /** intake-pipeline object id of the winning asset (image/video). */
  topAssetIntakeObjectId: z.string().optional(),
  topPerformanceMetric: z.enum(['ctr', 'watchTime', 'atc', 'purchase', 'opt-in']),
  value: z.number(),
});
export type CreativeWinner = z.infer<typeof CreativeWinnerSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Supplier links (a product may link to many supplier candidates)
 * ──────────────────────────────────────────────────────────────────────── */

/** A link between a Product and a SupplierCandidate (the dedicated supplier
 *  row from `product-intelligence`'s AliExpress/1688/Taobao/CSSBuy/manual
 *  adapters). Many supplier candidates can match one product. */
export const SupplierLinkSchema = z.object({
  /** SupplierCandidate id (z.string().uuid()) from product-intelligence. */
  supplierId: z.string().uuid(),
  linkedAt: z.string().datetime(),
  /** Mirrors `SupplierCandidateSchema.source` from product-intelligence. */
  source: z.enum(['aliexpress', '1688', 'taobao', 'cssbuy', 'manual']),
  /** 0..1 confidence — typically copied from
   *  `SupplierCandidateSchema.productMatchConfidence` at link time, may be
   *  overridden by operator. */
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
});
export type SupplierLink = z.infer<typeof SupplierLinkSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Consolidation audit (merge operations)
 * ──────────────────────────────────────────────────────────────────────── */

/** Audit row appended to a surviving Product when other products were
 *  consolidated into it. The merged-from products keep their original ids
 *  in the data layer but are flipped to `lifecycleState='consolidated'`
 *  with a back-pointer to the survivor (handled at the service layer; the
 *  back-pointer mechanic is not part of the schema). */
export const ConsolidationEntrySchema = z.object({
  consolidatedAt: z.string().datetime(),
  mergedFromProductIds: z.array(ProductIdSchema).min(1),
  reason: z.string(),
});
export type ConsolidationEntry = z.infer<typeof ConsolidationEntrySchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Sub-shapes embedded on Product
 * ──────────────────────────────────────────────────────────────────────── */

/** One source row on a Product. A single Product may have been discovered
 *  from multiple candidates across multiple source families (e.g. an Amazon
 *  listing + a TikTok organic video about the same item). */
export const ProductSourceRefSchema = z.object({
  /** ProductCandidate id (z.string().uuid()) from product-intelligence. */
  candidateId: z.string().uuid(),
  source: SourceFamily,
  registeredAt: z.string().datetime(),
});
export type ProductSourceRef = z.infer<typeof ProductSourceRefSchema>;

/** Curated, role-tagged media reference on a Product. The raw `mediaRefs`
 *  from a ProductCandidate are filtered and re-tagged here (a 200-image
 *  AliExpress listing collapses to a few `hero` / `lifestyle` / `detail`
 *  curated picks). `generated` is media produced by `media-generation`. */
export const ProductMediaRefSchema = z.object({
  kind: z.enum(['hero', 'lifestyle', 'detail', 'supplier', 'generated']),
  intakeObjectId: z.string(),
  addedAt: z.string().datetime(),
  role: z.string().optional(),
});
export type ProductMediaRef = z.infer<typeof ProductMediaRefSchema>;

/** Pricing block. All fields denormalized so the funnel + scoring layers
 *  do not need to recompute margin on every render. `lastComputedAt`
 *  is the cache-invalidation hint (re-run when costs change). */
export const ProductPricingSchema = z.object({
  displayPriceUsd: z.number().nonnegative().optional(),
  landedCostUsd: z.number().nonnegative().optional(),
  marginUsd: z.number().optional(),
  marginPct: z.number().optional(),
  lastComputedAt: z.string().datetime().optional(),
});
export type ProductPricing = z.infer<typeof ProductPricingSchema>;

/** Cluster assignment from `vectorize` (per MJB primitive 45). One product
 *  belongs to at most one cluster; cluster membership is re-evaluated by
 *  the dedupe-scan job and overwritten when confidence improves. */
export const ProductClusterSchema = z.object({
  clusterId: z.string(),
  assignedAt: z.string().datetime(),
  confidence: z.number().min(0).max(1),
});
export type ProductCluster = z.infer<typeof ProductClusterSchema>;

/** Red-flag row (per MJB primitive 84). Any red flag at `severity='blocker'`
 *  forces the product to `decisionState='SKIP'` regardless of score. */
export const RedFlagSchema = z.object({
  flag: z.string(),
  raisedAt: z.string().datetime(),
  /** Capability id (or operator user id) that raised the flag. */
  raisedBy: z.string(),
  severity: z.enum(['warn', 'blocker']),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * THE CENTRAL PRODUCT SCHEMA
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * The canonical Product entity. Read by:
 *   product-scoring, ugc-concept-engine, funnel-builder, social-distribution,
 *   performance-loop, content-dashboard, session-digest, notify, paypal-payments
 *
 * Written by:
 *   product-registry (CRUD), product-scoring (scoreHistory append),
 *   performance-loop (creativeWinners append), connector-config-aware
 *   workflows (brandLane re-assignment).
 *
 * BREAKING-CHANGE RULE: any field add/remove/retype here must bump
 * `schemaVersion`. Migrations live in the service layer; old shapes must
 * remain replayable for primitive 92's monthly diffs.
 */
export const ProductSchema = z.object({
  id: ProductIdSchema,
  lifecycleState: LifecycleStateSchema,
  decisionState: DecisionStateSchema,
  /** Nullable while pending operator lane assignment. */
  brandLane: BrandLaneSchema.optional(),

  /** Curated. May differ from the raw `ProductCandidate.name` (operator
   *  edits, brand naming, translation). */
  name: z.string(),
  description: z.string(),
  /** Used by funnel-builder + ugc-concept-engine when present. */
  tagline: z.string().optional(),

  cluster: ProductClusterSchema.optional(),

  /** All ProductCandidate rows this Product was registered from. */
  sources: z.array(ProductSourceRefSchema).default([]),
  /** All SupplierCandidate links. A product can have many. */
  suppliers: z.array(SupplierLinkSchema).default([]),

  pricing: ProductPricingSchema.default({}),

  /** Chronological, append-only. Never overwritten — primitive 92 needs
   *  history to compute month-over-month decision-state diffs. */
  scoreHistory: z.array(ScoreEntrySchema).default([]),
  /** Denormalized convenience accessor — mirrors `scoreHistory[length-1]`.
   *  The service layer keeps this in sync; consumers may rely on it. */
  latestScore: ScoreEntrySchema.optional(),

  /** Top hook / asset / metric per test window. Append-only. */
  creativeWinners: z.array(CreativeWinnerSchema).default([]),

  /** Audit trail for merge operations on this product. */
  consolidationHistory: z.array(ConsolidationEntrySchema).default([]),

  /** Per MJB primitive 84. A single `severity='blocker'` row gates the
   *  product to SKIP. */
  redFlags: z.array(RedFlagSchema).default([]),

  /** Curated, role-tagged. The raw `mediaRefs` from ProductCandidate are
   *  filtered and re-tagged into this list. */
  mediaRefs: z.array(ProductMediaRefSchema).default([]),

  /** Extension point. Document expected keys in `docs/metadata-keys.md`
   *  when patterns emerge; until then, expect ad-hoc additions by
   *  downstream caps (funnel-builder may stash funnel slug, etc.). */
  metadata: z.record(z.unknown()).default({}),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().optional(),

  /** Bump on any breaking field change. Starts at 1. */
  schemaVersion: z.number().int().positive().default(1),
});
export type Product = z.infer<typeof ProductSchema>;
