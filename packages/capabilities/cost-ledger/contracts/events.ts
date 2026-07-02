/**
 * cost-ledger contracts — canonical 1.0.0 event shape.
 *
 * Capabilities that incur cost (media-generation, ai-orchestration,
 * replicate-api, deepseek-router, product-intelligence, etc.) emit
 * `cost.recorded`; the ledger aggregates, evaluates budget policies, and
 * re-emits `cost.budget.exceeded` (consumed by notify for alerting and by
 * downstream caps for throttle/hard-stop). Periodic rollup jobs emit
 * `cost.report.generated` for review packets.
 *
 * The canonical `cost.recorded` shape (this file) is the single source of
 * truth. The `CostLedger` class in `packages/core/src/cost-ledger.ts`
 * implements the runtime and emits this shape. The legacy shape (pre-1.0.0,
 * with `source` / `amountUsd` / `category` / `at`) is preserved as
 * `CostRecordedLegacySchema` + `costRecordedFromLegacy()` for adapter use
 * only — deprecated; will be removed in v0.2.0.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = '1.0.0' as const;

export const CostCategory = z.enum([
  'ai-tokens',
  'ai-image',
  'ai-video',
  'ai-audio',
  'infra',
  'third-party-api',
  'other',
]);
export type CostCategory = z.infer<typeof CostCategory>;

export const BudgetScope = z.enum([
  'capability',
  'product',
  'brand-lane',
  'daily',
  'monthly',
]);
export type BudgetScope = z.infer<typeof BudgetScope>;

export const BudgetAction = z.enum(['alert', 'throttle', 'hard-stop']);
export type BudgetAction = z.infer<typeof BudgetAction>;

/**
 * Snapshot of budget headroom at the time a `cost.recorded` event was
 * stamped. Optional — emitters that don't track budget against this spend
 * leave it off. Distinct from `BudgetScope` above: this is the runtime-snap
 * dimension (per-product / per-lane-daily / global-daily), where the
 * `BudgetScope` enum drives `cost.budget.exceeded`.
 */
export const BudgetSnapshotSchema = z.object({
  scope: z.enum(['perProduct', 'perBrandLaneDaily', 'globalDaily']),
  softCap: z.number().nonnegative(),
  hardCap: z.number().nonnegative(),
  remaining: z.number(),
});
export type BudgetSnapshot = z.infer<typeof BudgetSnapshotSchema>;

/**
 * Canonical 1.0.0 `cost.recorded` payload.
 *
 * - `totalCost` is authoritative when the provider reports billed amount
 *   directly. `units * unitCost == totalCost` is a soft invariant only —
 *   providers like deepseek bill in tokens with non-integer multipliers, so
 *   this is NOT asserted at the schema level.
 * - `currency` is locked to `'USD'` for v1. Emitters with non-USD provider
 *   invoices must convert before emitting.
 */
export const CostRecordedSchema = z.object({
  event: z.literal('cost.recorded'),
  version: z.literal(SCHEMA_VERSION),
  occurredAt: z.string().datetime(),
  /** Capability id of the emitter (e.g. 'media-generation', 'deepseek-router'). */
  capability: z.string().min(1),
  /** Optional run correlation id (run_...) from a workflow execution. */
  workflowRunId: z.string().optional(),
  /** Optional product-candidate id (pc_...) from product-intelligence. */
  productCandidateId: z.string().optional(),
  /** Optional brand-lane id (lane_...) from product-registry. */
  brandLaneId: z.string().optional(),
  /** Provider id (rapidapi, deepseek, replicate, anthropic, openai, ollama, ...). */
  provider: z.string().min(1),
  /** Specific operation, finer than category (e.g. 'product.lookup', 'llm.completion', 'image.generate'). */
  operation: z.string().min(1),
  /** Quantity of the metered unit (tokens, images, seconds, requests). */
  units: z.number().nonnegative(),
  /** USD per unit. Soft-invariant: units * unitCost ≈ totalCost. */
  unitCost: z.number().nonnegative(),
  /** Authoritative billed amount in USD. Trust this over units * unitCost. */
  totalCost: z.number().nonnegative(),
  currency: z.literal('USD'),
  budget: BudgetSnapshotSchema.optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type CostRecorded = z.infer<typeof CostRecordedSchema>;

export const CostBudgetExceededSchema = z.object({
  event: z.literal('cost.budget.exceeded'),
  scope: BudgetScope,
  /** Identifier within the scope (capability id, product id, lane slug, ISO date). */
  scopeId: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  budgetUsd: z.number().nonnegative(),
  actualUsd: z.number().nonnegative(),
  exceededBy: z.number().nonnegative(),
});
export type CostBudgetExceeded = z.infer<typeof CostBudgetExceededSchema>;

export const CostReportGeneratedSchema = z.object({
  event: z.literal('cost.report.generated'),
  reportId: z.string().uuid(),
  /** Free-form scope label for the report ('product:abc123', 'daily:2026-06-29'). */
  scope: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalUsd: z.number().nonnegative(),
  /** Roll-up keyed by `operation` (e.g. 'llm.completion', 'image.generate'). */
  breakdownByOperation: z.record(z.number().nonnegative()),
  /** Roll-up keyed by `capability` (formerly `breakdownBySource`). */
  breakdownByCapability: z.record(z.number().nonnegative()),
  /** Roll-up keyed by `provider`. */
  breakdownByProvider: z.record(z.number().nonnegative()),
});
export type CostReportGenerated = z.infer<typeof CostReportGeneratedSchema>;

/**
 * Configuration shape (not a bus event). Operators install BudgetPolicy
 * rows via `POST /api/cost/budget`; the ledger evaluates them after every
 * `cost.recorded` and emits `cost.budget.exceeded` when actualUsd > limit
 * within the period window.
 */
export const BudgetPolicySchema = z.object({
  scope: BudgetScope,
  scopeId: z.string(),
  limitUsd: z.number().positive(),
  /** Rolling window length in milliseconds. */
  periodMs: z.number().int().positive(),
  action: BudgetAction,
});
export type BudgetPolicy = z.infer<typeof BudgetPolicySchema>;

export const EVENT_NAMES = {
  recorded: 'cost.recorded',
  budgetExceeded: 'cost.budget.exceeded',
  reportGenerated: 'cost.report.generated',
} as const;

// ---------------------------------------------------------------------------
// Legacy adapter — pre-1.0.0 shape, preserved for migration only.
// Deprecated; will be removed in v0.2.0.
// ---------------------------------------------------------------------------

/**
 * @deprecated Pre-1.0.0 `cost.recorded` payload shape. Use
 *   `CostRecordedSchema` for new code and `costRecordedFromLegacy()` to
 *   migrate old emitters. Scheduled for removal in v0.2.0.
 */
export const CostRecordedLegacySchema = z.object({
  event: z.literal('cost.recorded'),
  /** Capability id of the emitter (legacy: was named `source`). */
  source: z.string(),
  category: CostCategory,
  amountUsd: z.number().nonnegative(),
  /** Quantity of the metered unit (tokens, images, seconds). */
  units: z.number().nonnegative().optional(),
  /** Free-form unit kind for display ('tokens', 'images', 'seconds', 'requests'). */
  unitsKind: z.string().optional(),
  /** Correlation id — links cost to a product, job, or generation batch. */
  ref: z.string().optional(),
  at: z.string().datetime(),
});
/** @deprecated See {@link CostRecordedLegacySchema}. */
export type CostRecordedLegacy = z.infer<typeof CostRecordedLegacySchema>;

/**
 * Map a legacy `cost.recorded` payload to the canonical 1.0.0 shape.
 * One-way only — there is no canonical → legacy reverse adapter.
 *
 * Field mapping:
 * - `source`     → `capability`
 * - `amountUsd`  → `totalCost`  (authoritative)
 * - `category`   → `operation`  (legacy enum stored verbatim; richer
 *                   operations like 'llm.completion' should be picked by
 *                   the emitter on the new path)
 * - `at`         → `occurredAt`
 * - `provider`   → `'unknown'`  (legacy shape did not carry it)
 * - `units`      → `units ?? 1`
 * - `unitCost`   → `amountUsd / units` (derived; matches totalCost when units=1)
 * - `currency`   → `'USD'`      (v1 invariant)
 * - `metadata`   → `{ legacy: true, originalCategory, unitsKind?, ref? }`
 *
 * @deprecated Bridge only — drop callers off the legacy shape ahead of v0.2.0.
 */
export function costRecordedFromLegacy(legacy: CostRecordedLegacy): CostRecorded {
  const units = legacy.units ?? 1;
  const unitCost = units > 0 ? legacy.amountUsd / units : 0;
  const metadata: Record<string, unknown> = {
    legacy: true,
    originalCategory: legacy.category,
  };
  if (legacy.unitsKind) metadata.unitsKind = legacy.unitsKind;
  if (legacy.ref) metadata.ref = legacy.ref;
  return {
    event: 'cost.recorded',
    version: SCHEMA_VERSION,
    occurredAt: legacy.at,
    capability: legacy.source,
    provider: 'unknown',
    operation: legacy.category,
    units,
    unitCost,
    totalCost: legacy.amountUsd,
    currency: 'USD',
    metadata,
  };
}
