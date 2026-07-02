/**
 * performance-loop contracts — bus events.
 *
 * Every event listed in `manifest.yaml provides.events[]` has a typed
 * schema here. The two events with the strongest invariants:
 *
 *   - `perf.decision-state.changed` — the audit trail for KILL/RETEST/
 *     KEEP/BUILD/SCALE transitions. Consumers (notify, content-dashboard)
 *     use this to page operators on KILL / SCALE and to refresh the
 *     review queue. Every change carries a `reason` + `evidence` block.
 *
 *   - `perf.feedback.routed` — the OUTBOUND emission that closes the
 *     loop back into upstream caps (product-scoring, ugc-concept-engine,
 *     media-generation, funnel-builder, supplier rescore). Consumers
 *     read `target` to know if the payload is for them and `payload`
 *     for the domain-specific projection.
 */
import { z } from 'zod';

import {
  CommentObjectionCaptureSchema,
  CostPerResultSchema,
  CreativeWinnerSchema,
  DecisionStateChangeSchema,
  FeedbackRoutingSchema,
  PerfSnapshotSchema,
  ReviewPacketSchema,
} from './perf.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Snapshot + decision-state
 * ──────────────────────────────────────────────────────────────────────── */

export const PerfSnapshotRecordedSchema = z.object({
  event: z.literal('perf.snapshot.recorded'),
  snapshot: PerfSnapshotSchema,
});
export type PerfSnapshotRecorded = z.infer<typeof PerfSnapshotRecordedSchema>;

export const PerfDecisionStateChangedSchema = z.object({
  event: z.literal('perf.decision-state.changed'),
  change: DecisionStateChangeSchema,
});
export type PerfDecisionStateChanged = z.infer<typeof PerfDecisionStateChangedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Creative winners
 * ──────────────────────────────────────────────────────────────────────── */

export const PerfCreativeWinnerDetectedSchema = z.object({
  event: z.literal('perf.creative-winner.detected'),
  winner: CreativeWinnerSchema,
});
export type PerfCreativeWinnerDetected = z.infer<typeof PerfCreativeWinnerDetectedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Feedback routing (outbound to upstream caps)
 * ──────────────────────────────────────────────────────────────────────── */

export const PerfFeedbackRoutedSchema = z.object({
  event: z.literal('perf.feedback.routed'),
  routing: FeedbackRoutingSchema,
});
export type PerfFeedbackRouted = z.infer<typeof PerfFeedbackRoutedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Rollups (weekly + monthly review packets)
 * ──────────────────────────────────────────────────────────────────────── */

export const PerfWeeklyRollupReadySchema = z.object({
  event: z.literal('perf.weekly-rollup.ready'),
  packet: ReviewPacketSchema,
});
export type PerfWeeklyRollupReady = z.infer<typeof PerfWeeklyRollupReadySchema>;

export const PerfMonthlyRollupReadySchema = z.object({
  event: z.literal('perf.monthly-rollup.ready'),
  packet: ReviewPacketSchema,
});
export type PerfMonthlyRollupReady = z.infer<typeof PerfMonthlyRollupReadySchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Cost-per-result + returns + comments
 * ──────────────────────────────────────────────────────────────────────── */

export const PerfCostPerResultComputedSchema = z.object({
  event: z.literal('perf.cost-per-result.computed'),
  costPerResult: CostPerResultSchema,
});
export type PerfCostPerResultComputed = z.infer<typeof PerfCostPerResultComputedSchema>;

export const PerfReturnSignalRecordedSchema = z.object({
  event: z.literal('perf.return-signal.recorded'),
  productId: z.string(),
  /** Refunds + returns within the window. */
  returnCount: z.number().int().min(0),
  /** Estimated USD value of the returned units. */
  estimatedRefundUsd: z.number().min(0),
  windowStartAt: z.string().datetime(),
  windowEndAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
});
export type PerfReturnSignalRecorded = z.infer<typeof PerfReturnSignalRecordedSchema>;

export const PerfCommentObjectionCapturedSchema = z.object({
  event: z.literal('perf.comment.objection.captured'),
  capture: CommentObjectionCaptureSchema,
});
export type PerfCommentObjectionCaptured = z.infer<typeof PerfCommentObjectionCapturedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Event name registry
 * ──────────────────────────────────────────────────────────────────────── */

export const EVENT_NAMES = {
  snapshotRecorded: 'perf.snapshot.recorded',
  decisionStateChanged: 'perf.decision-state.changed',
  creativeWinnerDetected: 'perf.creative-winner.detected',
  feedbackRouted: 'perf.feedback.routed',
  weeklyRollupReady: 'perf.weekly-rollup.ready',
  monthlyRollupReady: 'perf.monthly-rollup.ready',
  costPerResultComputed: 'perf.cost-per-result.computed',
  returnSignalRecorded: 'perf.return-signal.recorded',
  commentObjectionCaptured: 'perf.comment.objection.captured',
} as const;
