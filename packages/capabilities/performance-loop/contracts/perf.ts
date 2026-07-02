/**
 * performance-loop canonical shapes.
 *
 * L3 MJB capability. THE 10-METRIC RECORD (`PerfMetricSchema`) is the
 * contract — every platform's per-post metrics are normalized into this
 * shape on ingest. Platforms surface different superset metrics, but the
 * rollup math operates only on these 10. The shape is intentionally
 * minimal so cross-platform comparison stays honest.
 *
 * Sibling files:
 *   - `events.ts` — typed bus events
 *   - `index.ts`  — barrel
 *
 * Cross-capability reads:
 *   - `product-registry`  — DecisionState enum + creativeWinners append target
 *   - `social-distribution` — post identity (platform + platformPostId)
 *   - `cost-ledger`       — cost rows joined into CostPerResult
 *   - `scheduler`         — drives the rollup jobs (weekly + monthly)
 *   - `session-digest`    — consumes ReviewPacket for HTML render
 */
import { z } from 'zod';

import { DecisionStateSchema, BrandLaneSchema } from '../../product-registry/contracts/product.js';

/* ─────────────────────────────────────────────────────────────────────────
 * The 10-metric record (THE contract — MJB primitives 89-91)
 * ──────────────────────────────────────────────────────────────────────── */

/** The 10 normalized metrics per snapshot. Every field is non-negative;
 *  unknown/missing platform metrics encode as 0 (not omitted) so the
 *  rollup math has no `undefined`-handling branches.
 *
 *  Field-by-field meaning:
 *    views                  — impressions / video-plays / page-loads as the
 *                             platform defines its "view"
 *    watchTime              — seconds (sum across the window)
 *    saves                  — bookmarks / saves / pins (platform-native)
 *    shares                 — outbound shares / reposts / reshares
 *    clicks                 — outbound clicks on the attached funnel link
 *    atc                    — add-to-cart events on the destination funnel
 *    purchases              — completed purchases attributed to this post
 *    optins                 — email/SMS opt-ins on the destination funnel
 *    returns                — refunds / returns attributed back to the post
 *    commentLanguageSamples — count of comments captured for objection /
 *                             language analysis (the source data the
 *                             ugc-concept-engine and product-scoring loops
 *                             consume for hook + objection mining)
 */
export const PerfMetricSchema = z.object({
  views: z.number().min(0),
  watchTime: z.number().min(0),
  saves: z.number().min(0),
  shares: z.number().min(0),
  clicks: z.number().min(0),
  atc: z.number().min(0),
  purchases: z.number().min(0),
  optins: z.number().min(0),
  returns: z.number().min(0),
  commentLanguageSamples: z.number().min(0),
});
export type PerfMetric = z.infer<typeof PerfMetricSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Per-window snapshot
 * ──────────────────────────────────────────────────────────────────────── */

/** A single platform-side snapshot for one post over one window. The
 *  rollup job stitches these together over the requested period. Snapshots
 *  are APPEND-ONLY — overwriting an old window's snapshot would break the
 *  monthly diff in primitive 92's spirit. */
export const PerfSnapshotSchema = z.object({
  snapshotId: z.string(),
  productId: z.string(),
  brandLane: BrandLaneSchema.optional(),
  /** Refs the social-distribution post identity. */
  platformPostRef: z.object({
    platform: z.string(),
    platformPostId: z.string(),
  }),
  windowStartAt: z.string().datetime(),
  windowEndAt: z.string().datetime(),
  metrics: PerfMetricSchema,
  /** Name of the platform / 3rd-party provider that supplied this snapshot
   *  (e.g. 'tiktok-graph-api', 'meta-insights', 'manual-import'). */
  sourceProvider: z.string(),
  recordedAt: z.string().datetime(),
});
export type PerfSnapshot = z.infer<typeof PerfSnapshotSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Decision-state changes (append-only history, like product-registry's)
 * ──────────────────────────────────────────────────────────────────────── */

/** Every decision-state transition for a product. APPEND-ONLY. The
 *  product-registry holds the current decisionState; this is the audit
 *  trail of how it got there from a perf-loop perspective. `reason` is
 *  the source-of-truth: `auto-rollup` (the weekly/monthly job decided),
 *  `operator-override` (manual via API), `cost-cap-hit` (cost-ledger
 *  signalled spend cap reached), `red-flag-raised` (product-registry
 *  raised a blocker red flag that forced SKIP). */
export const DecisionStateChangeSchema = z.object({
  productId: z.string(),
  fromState: DecisionStateSchema,
  toState: DecisionStateSchema,
  reason: z.enum([
    'auto-rollup',
    'operator-override',
    'cost-cap-hit',
    'red-flag-raised',
  ]),
  evidence: z.object({
    snapshotIds: z.array(z.string()).default([]),
    scoreEntryIds: z.array(z.string()).default([]),
  }),
  changedAt: z.string().datetime(),
});
export type DecisionStateChange = z.infer<typeof DecisionStateChangeSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Creative winner detection (per test window)
 * ──────────────────────────────────────────────────────────────────────── */

/** A per-window winner. The product-registry ALSO has a CreativeWinnerSchema —
 *  but that one is the LANDED, append-only record on the Product. This one
 *  is the perf-loop's COMPUTED detection, which then propagates back to the
 *  registry via the `product-registry:append creativeWinner` write. Two
 *  shapes, two concerns: detection vs. archival. */
export const CreativeWinnerSchema = z.object({
  winnerId: z.string(),
  productId: z.string(),
  brandLane: BrandLaneSchema.optional(),
  testWindow: z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }),
  topHook: z.string().optional(),
  /** intake-pipeline object id of the winning asset. */
  topAssetIntakeObjectId: z.string().optional(),
  topPerformanceMetric: z.enum([
    'ctr',
    'watchTime',
    'atc',
    'purchase',
    'optin',
    'share-rate',
  ]),
  value: z.number(),
  computedAt: z.string().datetime(),
});
export type CreativeWinner = z.infer<typeof CreativeWinnerSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Feedback routing (the loop's outbound emissions)
 * ──────────────────────────────────────────────────────────────────────── */

/** A routed feedback record. Feedback routing is intentionally LOSSY:
 *  each downstream target gets a domain-specific projection of the
 *  snapshot, not the raw 10 metrics. `target` is the closed enum of
 *  every capability we know how to route to. `processedAt` is set by the
 *  consumer when it acknowledges. */
export const FeedbackRoutingSchema = z.object({
  routingId: z.string(),
  productId: z.string(),
  target: z.enum([
    'product-scoring',
    'ugc-concept-engine',
    'media-generation',
    'funnel-builder',
    'supplier-rescore',
  ]),
  payload: z.record(z.unknown()),
  routedAt: z.string().datetime(),
  processedAt: z.string().datetime().optional(),
});
export type FeedbackRouting = z.infer<typeof FeedbackRoutingSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Cost-per-result (cost-ledger × perf-loop join)
 * ──────────────────────────────────────────────────────────────────────── */

/** Per-asset cost-per-result. Joins cost-ledger entries (ad spend,
 *  creative cost, supplier cost) with the perf snapshots over the same
 *  window. KNOWN NOISE: cost attribution windows do not always align
 *  with conversion windows — operators see noisier numbers in the first
 *  48h after a post and should weight monthly rollups more heavily.
 *  The schema documents the assumed window; the math is in the service. */
export const CostPerResultSchema = z.object({
  productId: z.string(),
  assetIntakeObjectId: z.string(),
  period: z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }),
  totalCostUsd: z.number().min(0),
  primaryResultMetric: z.enum(['purchase', 'optin', 'atc']),
  resultCount: z.number().min(0),
  /** Computed as `totalCostUsd / max(1, resultCount)`. Persisted (not
   *  recomputed by consumers) so dashboard reads are O(1) and so the
   *  div-by-zero guard is enforced in one place. */
  costPerResult: z.number().min(0),
  computedAt: z.string().datetime(),
});
export type CostPerResult = z.infer<typeof CostPerResultSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Comment-objection capture (feeds ugc-concept-engine + product-scoring)
 * ──────────────────────────────────────────────────────────────────────── */

/** A captured comment that surfaced a buyer objection or language-mining
 *  signal. `objectionCategory` is optional because classification is a
 *  separate step (this row records the raw capture; the classifier
 *  enriches later). `sentimentScore` is -1..1. */
export const CommentObjectionCaptureSchema = z.object({
  captureId: z.string(),
  productId: z.string(),
  platform: z.string(),
  platformCommentId: z.string(),
  text: z.string(),
  objectionCategory: z.string().optional(),
  sentimentScore: z.number().min(-1).max(1).optional(),
  capturedAt: z.string().datetime(),
});
export type CommentObjectionCapture = z.infer<typeof CommentObjectionCaptureSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Review packet (weekly / monthly digest data)
 * ──────────────────────────────────────────────────────────────────────── */

/** The data payload that drives the weekly + monthly review HTML/email.
 *  This capability produces the data; `session-digest` renders it. The
 *  shape is intentionally aggregate-first (the `summary` block carries
 *  the headline numbers; `perProductHighlights` is the per-product drill-
 *  down). */
export const ReviewPacketSchema = z.object({
  packetId: z.string(),
  period: z.enum(['weekly', 'monthly']),
  brandLane: BrandLaneSchema.optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  summary: z.object({
    productsTested: z.number().int().min(0),
    productsKilled: z.number().int().min(0),
    productsScaled: z.number().int().min(0),
    totalSpendUsd: z.number().min(0),
    totalRevenueUsd: z.number().min(0),
    costPerResultMedian: z.number().min(0),
  }),
  perProductHighlights: z.array(
    z.object({
      productId: z.string(),
      decisionStateChange: DecisionStateChangeSchema.optional(),
      winners: z.array(CreativeWinnerSchema).default([]),
      topObjections: z.array(CommentObjectionCaptureSchema).default([]),
    }),
  ).default([]),
  generatedAt: z.string().datetime(),
});
export type ReviewPacket = z.infer<typeof ReviewPacketSchema>;
