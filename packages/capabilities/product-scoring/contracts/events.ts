/**
 * product-scoring contracts — bus events.
 *
 * Every event declared in `manifest.yaml provides.events[]` has a typed
 * zod schema here. Payloads embed the heavier shapes from `./score.js`
 * (ScoreComputation, MarginComputation, SupplierConfidence, RedFlag) so
 * consumers do not need a follow-up fetch to render a row.
 *
 * Companion: see `./score.js` for the scorecard, computation, margin,
 * supplier-confidence, work-allowance, and red-flag schemas.
 */
import { z } from 'zod';

import {
  DecisionStateSchema,
  ProductIdSchema,
} from '../../product-registry/contracts/product.js';

import {
  DecisionBandSchema,
  MarginComputationSchema,
  RedFlagSchema,
  ScoreComputationSchema,
  SupplierConfidenceSchema,
} from './score.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Scoring — primary output of a /api/score/compute run
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductScoredSchema = z.object({
  event: z.literal('product.scored'),
  productId: ProductIdSchema,
  computation: ScoreComputationSchema,
});
export type ProductScored = z.infer<typeof ProductScoredSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Decision-state tag (companion to product.scored)
 *
 * Emitted in addition to product.scored when the score causes a transition
 * (or an operator triage flips the state). Carrying the prior state lets
 * subscribers detect transitions without diffing the registry.
 *
 * Decision-state monotonicity: see README — BUILD→KILL is allowed without
 * a `priorDecisionState` round-trip, but BUILD→TEST requires an explicit
 * operator override (this event still emits — the registry is the enforcer).
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductDecisionTaggedSchema = z.object({
  event: z.literal('product.decision.tagged'),
  productId: ProductIdSchema,
  decisionState: DecisionStateSchema,
  band: DecisionBandSchema,
  /** Prior state if this is a transition (omitted for first-tag). */
  priorDecisionState: DecisionStateSchema.optional(),
  /** Capability id or operator user id that tagged. */
  taggedBy: z.string(),
  taggedAt: z.string().datetime(),
});
export type ProductDecisionTagged = z.infer<typeof ProductDecisionTaggedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Supplier confidence (companion / standalone output of supplier-confidence run)
 *
 * Standalone because supplier confidence can be recomputed independently of
 * a full score (e.g. when a new SupplierLink lands without other signals
 * changing). When emitted as part of a full scoring run the same value
 * also rides inline on ScoreComputation.supplierConfidence.
 * ──────────────────────────────────────────────────────────────────────── */

export const SupplierConfidenceComputedSchema = z.object({
  event: z.literal('supplier.confidence.computed'),
  productId: ProductIdSchema,
  /** SupplierCandidate id from product-intelligence (uuid). */
  supplierId: z.string().uuid(),
  confidence: SupplierConfidenceSchema,
});
export type SupplierConfidenceComputed = z.infer<typeof SupplierConfidenceComputedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Margin (companion / standalone)
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductMarginComputedSchema = z.object({
  event: z.literal('product.margin.computed'),
  productId: ProductIdSchema,
  margin: MarginComputationSchema,
});
export type ProductMarginComputed = z.infer<typeof ProductMarginComputedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Red-flag raised (MJB primitives 72, 82, 83)
 *
 * Emitted whenever the scorer raises a flag, irrespective of whether a
 * full score is being computed in the same run. Severity='blocker'
 * implies the scorer has ALREADY (or will immediately) emit a
 * product.decision.tagged with decisionState=SKIP — consumers should not
 * have to derive the implication.
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductRedFlagRaisedSchema = z.object({
  event: z.literal('product.red-flag.raised'),
  productId: ProductIdSchema,
  redFlag: RedFlagSchema,
});
export type ProductRedFlagRaised = z.infer<typeof ProductRedFlagRaisedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Supplier rejected (MJB primitive 82)
 *
 * Distinct from supplier.unlinked (registry): rejected means the scorer
 * has actively *decided against* this supplier (sizing/fit risk, fragile
 * parts with no margin cushion, inconsistent specs). The registry may
 * still hold the SupplierLink — the rejection is advisory unless an
 * operator unlinks. The reason vocabulary matches the README of MJB
 * primitive 82.
 * ──────────────────────────────────────────────────────────────────────── */

export const SupplierRejectedSchema = z.object({
  event: z.literal('supplier.rejected'),
  productId: ProductIdSchema,
  supplierId: z.string().uuid(),
  reason: z.enum([
    'sizing-fit-risk',
    'exaggerated-claims-required',
    'fragile-no-margin-cushion',
    'inconsistent-specs',
    'unstable-supplier',
    'other',
  ]),
  notes: z.string().optional(),
  rejectedBy: z.string(),
  rejectedAt: z.string().datetime(),
});
export type SupplierRejected = z.infer<typeof SupplierRejectedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Event name registry
 * ──────────────────────────────────────────────────────────────────────── */

export const EVENT_NAMES = {
  scored: 'product.scored',
  decisionTagged: 'product.decision.tagged',
  supplierConfidenceComputed: 'supplier.confidence.computed',
  marginComputed: 'product.margin.computed',
  redFlagRaised: 'product.red-flag.raised',
  supplierRejected: 'supplier.rejected',
} as const;
