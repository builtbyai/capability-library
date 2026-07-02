/**
 * product-scoring contracts — scorecard, margin, supplier-confidence,
 * work-allowance policy, and red-flag shapes.
 *
 * **Why these schemas live here and not in product-registry:**
 *   product-registry's `ScoreEntrySchema` is intentionally lenient
 *   (`categories: z.record(z.number().min(1).max(5))`) so the registry
 *   can store mixed-version history without back-filling. product-scoring
 *   is the *producer* — it owns the strongly-typed 8-category shape
 *   (`ScoreCategoriesSchema`), the scorecard version + weights
 *   (`ScorecardSchema`), and the full computation payload
 *   (`ScoreComputationSchema`) that lands on the bus as `product.scored`
 *   and is then narrowed into a `ScoreEntry` for registry persistence.
 *
 * Sibling: `./events.js` declares the typed bus events that wrap these
 * payloads; `./index.js` re-exports both.
 *
 * Companion concepts in registry:
 *   - `DecisionStateSchema` lives in product-registry and is re-imported
 *     here so `ScoreComputationSchema.decisionState` cannot drift from the
 *     registry's lifecycle vocabulary.
 *   - `latestScore` / `scoreHistory[]` on `Product` are written by this
 *     capability (via product-registry's `POST /api/products/:productId/score`).
 */
import { z } from 'zod';

import { DecisionStateSchema } from '../../product-registry/contracts/product.js';

/* ─────────────────────────────────────────────────────────────────────────
 * The 8 scoring categories (MJB primitive 21)
 *
 * Each category is rated 1-5 by the scorer (auto via deepseek-router or
 * manual via operator). Totals sum to 8 (worst) — 40 (best); the band map
 * in ScorecardSchema decides which decision-state the total maps to.
 *
 * The 8 categories are fixed in the schema (typed keys) — adding a 9th
 * category requires bumping `scorecardVersion` AND coordinating with
 * product-registry so historical entries remain replayable.
 * ──────────────────────────────────────────────────────────────────────── */

export const ScoreCategoriesSchema = z.object({
  demandVelocity: z.number().min(1).max(5),
  profitMargin: z.number().min(1).max(5),
  ugcPotential: z.number().min(1).max(5),
  supplierReliability: z.number().min(1).max(5),
  competitionSaturation: z.number().min(1).max(5),
  brandLaneFit: z.number().min(1).max(5),
  problemIntensity: z.number().min(1).max(5),
  complianceReturnRisk: z.number().min(1).max(5),
});
export type ScoreCategories = z.infer<typeof ScoreCategoriesSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Decision band — the 5-tier business outcome of a total score
 *
 * 80+   = launch    (BUILD)
 * 70-79 = test      (TEST)
 * 60-69 = watchlist (WATCH)
 * 50-59 = weak      (WATCH with notes)
 * <50   = reject    (SKIP)
 *
 * Stored as an enum on ScoreComputationSchema so consumers can switch on
 * the band without re-deriving from totalScore.
 * ──────────────────────────────────────────────────────────────────────── */

export const DecisionBandSchema = z.enum(['launch', 'test', 'watchlist', 'weak', 'reject']);
export type DecisionBand = z.infer<typeof DecisionBandSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Scorecard — version + weights + band thresholds
 *
 * Operators install / bump the scorecard via a privileged admin path.
 * `scorecardVersion` is the string that every ScoreComputation stamps so
 * the registry's append-only history can be rendered mixed-version without
 * recomputing old scores against the new weights.
 *
 * `decisionBands` thresholds are the *floor* of each band (inclusive):
 *   launch >= bands.launch
 *   test   >= bands.test
 *   watchlist >= bands.watchlist
 *   weak >= bands.rejectBelow
 *   reject < bands.rejectBelow
 * ──────────────────────────────────────────────────────────────────────── */

export const ScorecardSchema = z.object({
  scorecardVersion: z.string(),
  /** Per-category weights. Same 8 keys as ScoreCategoriesSchema; values
   *  are non-negative floats. Weighted total = sum(category * weight).
   *  Use weight=1 for unweighted scoring (sum 8-40). */
  weights: z.object({
    demandVelocity: z.number().min(0),
    profitMargin: z.number().min(0),
    ugcPotential: z.number().min(0),
    supplierReliability: z.number().min(0),
    competitionSaturation: z.number().min(0),
    brandLaneFit: z.number().min(0),
    problemIntensity: z.number().min(0),
    complianceReturnRisk: z.number().min(0),
  }),
  decisionBands: z.object({
    launch: z.number(),
    test: z.number(),
    watchlist: z.number(),
    rejectBelow: z.number(),
  }),
});
export type Scorecard = z.infer<typeof ScorecardSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * The central scoring event — emitted on `product.scored`
 *
 * Carries everything a downstream consumer needs without a second fetch:
 *   - the version of the scorecard used,
 *   - the 8-category rubric values (typed),
 *   - the rolled-up totalScore (already weighted),
 *   - the band + decision-state recommendation,
 *   - optional margin / supplier-confidence values inline so consumers
 *     do not have to dispatch follow-up `/margin` or `/supplier-confidence`
 *     calls to render a score row,
 *   - any red flags raised during the run,
 *   - audit metadata (computedAt, scorer).
 *
 * `decisionState` is constrained to the SAME enum that
 * product-registry's DecisionStateSchema exports — this prevents the
 * scorer from inventing a state the registry cannot store.
 * ──────────────────────────────────────────────────────────────────────── */

export const ScoreComputationSchema = z.object({
  scorecardVersion: z.string(),
  categories: ScoreCategoriesSchema,
  /** Weighted total. 0-100 in the launch-band scheme; the operator may
   *  configure a different range via Scorecard.weights, hence the open
   *  number bound instead of z.number().min(0).max(100). */
  totalScore: z.number().min(0).max(100),
  band: DecisionBandSchema,
  /** Recommendation for product-registry's decisionState field. Must be
   *  a value from DecisionStateSchema so the registry can persist it. */
  decisionState: DecisionStateSchema,
  marginUsd: z.number().optional(),
  supplierConfidence: z.enum(['Low', 'Med', 'High']).optional(),
  /** Free-form flag strings. Same severity vocabulary as RedFlagSchema. */
  redFlags: z.array(z.string()).default([]),
  computedAt: z.string().datetime(),
  /** Capability + model id (e.g. 'product-scoring@deepseek-v4' or
   *  'product-scoring@manual:user_42'). */
  scorer: z.string(),
  notes: z.string().optional(),
});
export type ScoreComputation = z.infer<typeof ScoreComputationSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Margin computation (MJB primitive 22 — full landed-cost margin)
 *
 * `breakdown` is intentionally typed (not z.record) so downstream review
 * packets can render the four cost legs as predictable columns. Add a new
 * leg only when bumping the scorecardVersion.
 * ──────────────────────────────────────────────────────────────────────── */

export const MarginComputationSchema = z.object({
  landedCostUsd: z.number().nonnegative(),
  sellingPriceUsd: z.number().nonnegative(),
  marginUsd: z.number(),
  marginPct: z.number(),
  computedAt: z.string().datetime(),
  breakdown: z.object({
    product: z.number().nonnegative(),
    shipping: z.number().nonnegative(),
    fees: z.number().nonnegative(),
    processing: z.number().nonnegative(),
  }),
});
export type MarginComputation = z.infer<typeof MarginComputationSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Supplier confidence (MJB primitive 23)
 *
 * Score is 0..1 (continuous) but bucketed into 3 tiers for the UI.
 * `signals` is the audit trail — each contributing signal carries its
 * weight + observed value so the operator can debug a Low confidence
 * decision without re-running the scoring pass.
 * ──────────────────────────────────────────────────────────────────────── */

export const SupplierConfidenceSchema = z.object({
  confidence: z.enum(['Low', 'Med', 'High']),
  score: z.number().min(0).max(1),
  signals: z.array(
    z.object({
      signal: z.string(),
      weight: z.number(),
      value: z.unknown(),
    }),
  ),
  computedAt: z.string().datetime(),
});
export type SupplierConfidence = z.infer<typeof SupplierConfidenceSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Work-allowance policy (MJB primitive 86)
 *
 * The work-allowance gate decides whether the scorer is *allowed* to spend
 * additional research/generation budget on a product. Attribution lookups
 * (current spend per product / per brand-lane / global) are performed
 * against cost-ledger via `cost.recorded.ref` matching — this schema only
 * encodes the policy thresholds, not the live spend numbers.
 *
 * `softCap` triggers an alert + operator approval requirement.
 * `hardCap` triggers a hard-stop; the scorer refuses to spend further
 * regardless of operator override (use `approvalRules.overHardCap` for the
 * override path).
 * ──────────────────────────────────────────────────────────────────────── */

export const WorkAllowancePolicySchema = z.object({
  perProduct: z.object({
    totalHardCap: z.number().nonnegative(),
  }),
  perBrandLaneDaily: z.object({
    softCap: z.number().nonnegative(),
    hardCap: z.number().nonnegative(),
  }),
  globalDaily: z.object({
    softCap: z.number().nonnegative(),
    hardCap: z.number().nonnegative(),
  }),
  approvalRules: z.object({
    overSoftCap: z.enum(['auto', 'operator', 'forbidden']),
    overHardCap: z.enum(['auto', 'operator', 'forbidden']),
    newConnectorSpend: z.enum(['auto', 'operator', 'forbidden']),
  }),
});
export type WorkAllowancePolicy = z.infer<typeof WorkAllowancePolicySchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Red-flag row (MJB primitives 72, 82, 83)
 *
 * Mirrors product-registry's RedFlagSchema BUT adds `source` + optional
 * `evidence` so the scorer can carry the rationale on the bus event.
 * The registry's RedFlagSchema does not need evidence (it stores the
 * persisted summary); the scoring event uses it for the audit replay.
 *
 * `severity='blocker'` forces decisionState=SKIP regardless of total score
 * (registry enforces this on persist; the scorer must already set
 * decisionState='SKIP' when emitting a blocker flag).
 * ──────────────────────────────────────────────────────────────────────── */

export const RedFlagSchema = z.object({
  flag: z.string(),
  severity: z.enum(['warn', 'blocker']),
  /** Capability id (or operator user id) that raised the flag. */
  source: z.string(),
  raisedAt: z.string().datetime(),
  evidence: z.record(z.unknown()).optional(),
});
export type RedFlag = z.infer<typeof RedFlagSchema>;
