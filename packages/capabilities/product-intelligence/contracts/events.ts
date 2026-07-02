/**
 * product-intelligence event contracts.
 *
 * Every event listed in `manifest.yaml provides.events[]` has a typed schema
 * here. Payloads embed the canonical shapes from `./product-candidate.js` so
 * downstream subscribers (product-registry, product-scoring, ugc-concept-engine,
 * performance-loop) all parse against the same source-of-truth schemas.
 *
 * Discriminated-union note: each event schema includes a literal `event` field
 * so a bus consumer that subscribes to multiple events from this capability
 * can do `z.discriminatedUnion('event', [...])` cleanly.
 */
import { z } from 'zod';
import {
  ProductCandidateSchema,
  PainPointSchema,
  SupplierCandidateSchema,
  SourceFamily,
} from './product-candidate.js';

/** ---- product candidate lifecycle ---- */

export const ProductCandidateDiscoveredEvent = z.object({
  event: z.literal('product.candidate.discovered'),
  runId: z.string().uuid(),
  candidate: ProductCandidateSchema,
});
export type ProductCandidateDiscovered = z.infer<typeof ProductCandidateDiscoveredEvent>;

export const ProductCandidateEnrichedEvent = z.object({
  event: z.literal('product.candidate.enriched'),
  candidateId: z.string().uuid(),
  /** The fields that the enrichment pass populated; same shape as ProductCandidate
   *  but every field optional — caller merges on top of the existing record. */
  patch: ProductCandidateSchema.partial(),
  enrichedAt: z.string().datetime(),
});
export type ProductCandidateEnriched = z.infer<typeof ProductCandidateEnrichedEvent>;

/** ---- supplier discovery ---- */

export const SupplierCandidateFoundEvent = z.object({
  event: z.literal('supplier.candidate.found'),
  /** The ProductCandidate this supplier match was sourced for. */
  forProductCandidateId: z.string().uuid(),
  supplier: SupplierCandidateSchema,
});
export type SupplierCandidateFound = z.infer<typeof SupplierCandidateFoundEvent>;

/** ---- buyer-language capture ---- */

export const PainPointCapturedEvent = z.object({
  event: z.literal('pain-point.captured'),
  runId: z.string().uuid(),
  painPoint: PainPointSchema,
});
export type PainPointCaptured = z.infer<typeof PainPointCapturedEvent>;

export const CommentCapturedEvent = z.object({
  event: z.literal('comment.captured'),
  runId: z.string().uuid(),
  source: SourceFamily,
  /** Source-side id of the post / video / listing this comment was attached to. */
  parentSourceId: z.string(),
  commentId: z.string(),
  authorHandle: z.string().optional(),
  text: z.string(),
  capturedAt: z.string().datetime(),
});
export type CommentCaptured = z.infer<typeof CommentCapturedEvent>;

export const ReviewTextCapturedEvent = z.object({
  event: z.literal('review-text.captured'),
  runId: z.string().uuid(),
  source: SourceFamily,
  /** Source-side product id the review is attached to. */
  parentSourceId: z.string(),
  reviewId: z.string(),
  rating: z.number().min(0).max(5).optional(),
  text: z.string(),
  capturedAt: z.string().datetime(),
});
export type ReviewTextCaptured = z.infer<typeof ReviewTextCapturedEvent>;

/** ---- trend / hashtag signals ---- */

export const HashtagSignalCapturedEvent = z.object({
  event: z.literal('hashtag-signal.captured'),
  runId: z.string().uuid(),
  /** Platform the signal was sampled from (TikTok, IG, Pinterest, X, ...). */
  platform: z.string(),
  tag: z.string(),
  niche: z.string().optional(),
  /** Aggregate signal — views, posts, growth-rate-pct. Shape is platform-specific. */
  metrics: z.record(z.number()),
  capturedAt: z.string().datetime(),
});
export type HashtagSignalCaptured = z.infer<typeof HashtagSignalCapturedEvent>;

/** ---- TOS / health / governance ---- */

export const TosBotDetectionTriggeredEvent = z.object({
  event: z.literal('tos.bot-detection.triggered'),
  source: SourceFamily,
  /** Adapter implementation id (e.g. 'amazon:rapidapi:real-time-amazon-data'). */
  adapterId: z.string(),
  detectedAt: z.string().datetime(),
  /** Why the runtime decided this was bot-detection (HTTP 403 streak,
   *  captcha redirect, account suspended response, etc.). */
  reason: z.string(),
  /** When the runtime will allow this source to resume scraping (auto-pause). */
  pauseUntil: z.string().datetime(),
});
export type TosBotDetectionTriggered = z.infer<typeof TosBotDetectionTriggeredEvent>;

/** ---- run lifecycle ---- */

export const ScrapeRunStartedEvent = z.object({
  event: z.literal('scrape.run.started'),
  runId: z.string().uuid(),
  source: SourceFamily,
  adapterId: z.string(),
  /** Free input params — scan query, niche, hashtag, lookup target, etc. */
  params: z.record(z.unknown()).default({}),
  startedAt: z.string().datetime(),
});
export type ScrapeRunStarted = z.infer<typeof ScrapeRunStartedEvent>;

export const ScrapeRunCompletedEvent = z.object({
  event: z.literal('scrape.run.completed'),
  runId: z.string().uuid(),
  source: SourceFamily,
  adapterId: z.string(),
  candidatesEmitted: z.number().int().nonnegative(),
  commentsEmitted: z.number().int().nonnegative().default(0),
  painPointsEmitted: z.number().int().nonnegative().default(0),
  reviewsEmitted: z.number().int().nonnegative().default(0),
  durationMs: z.number().int().nonnegative(),
  completedAt: z.string().datetime(),
});
export type ScrapeRunCompleted = z.infer<typeof ScrapeRunCompletedEvent>;

export const ScrapeRunFailedEvent = z.object({
  event: z.literal('scrape.run.failed'),
  runId: z.string().uuid(),
  source: SourceFamily,
  adapterId: z.string(),
  reason: z.enum([
    'rate-limit',
    'bot-detected',
    'tos-block',
    'auth-failed',
    'transient',
    'no-results',
    'unknown',
  ]),
  errorMessage: z.string().optional(),
  failedAt: z.string().datetime(),
});
export type ScrapeRunFailed = z.infer<typeof ScrapeRunFailedEvent>;

/** ---- cost ---- */

export const ScrapeCostRecordedEvent = z.object({
  event: z.literal('scrape.cost.recorded'),
  runId: z.string().uuid(),
  source: SourceFamily,
  adapterId: z.string(),
  amountUsd: z.number().nonnegative(),
  /** Quantity of metered units (API calls, proxy requests, captcha solves). */
  units: z.number().nonnegative().optional(),
  unitsKind: z.string().optional(),
  at: z.string().datetime(),
});
export type ScrapeCostRecorded = z.infer<typeof ScrapeCostRecordedEvent>;

/** Canonical event-name table. Mirrors `manifest.yaml provides.events[]`. */
export const EVENT_NAMES = {
  candidateDiscovered: 'product.candidate.discovered',
  candidateEnriched: 'product.candidate.enriched',
  supplierFound: 'supplier.candidate.found',
  painPointCaptured: 'pain-point.captured',
  commentCaptured: 'comment.captured',
  reviewTextCaptured: 'review-text.captured',
  hashtagSignalCaptured: 'hashtag-signal.captured',
  tosBotDetectionTriggered: 'tos.bot-detection.triggered',
  runStarted: 'scrape.run.started',
  runCompleted: 'scrape.run.completed',
  runFailed: 'scrape.run.failed',
  costRecorded: 'scrape.cost.recorded',
} as const;
