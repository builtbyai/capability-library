/**
 * ugc-concept-engine canonical shapes.
 *
 * This capability generates per-Product UGC creative concepts (hooks,
 * scripts, angles, lifestyle vignettes, objections, captions, storyboards)
 * by calling an LLM via deepseek-router. The shapes in this file are the
 * cross-capability contract: performance-loop reads `Concept` rows to
 * correlate hook families with conversion lift, content-dashboard renders
 * concept queues for operator review, and social-distribution attaches a
 * `Concept` to a scheduled post.
 *
 * THE AUTHENTICITY GATE IS THE LAW. Per MJB primitive 64, every generated
 * concept MUST be evaluated against a 5-question checklist:
 *   1. Does it claim a fake testimonial?
 *   2. Does it claim fake personal use ("I bought this") without evidence?
 *   3. Does it make a medical / safety / financial claim?
 *   4. Does it cite unverifiable specificity ("studies show", "experts say")?
 *   5. Does it fit the assigned brand lane's tone/voice?
 *
 * A concept with ANY of questions 1-4 = true OR question 5 = false is
 * REJECTED and emits `ugc.authenticity.rejected`. Rejected concepts MUST
 * NOT be marked `authenticityPassed: true`. The gate runs even when an
 * operator manually authors a concept — the gate is the firewall, not
 * the LLM's behavior.
 *
 * Sibling files:
 *   - `events.ts` — typed bus event schemas for the 6 manifest events.
 *   - `index.ts`  — barrel re-export.
 */
import { z } from 'zod';

import {
  BrandLaneSchema,
  ProductIdSchema,
} from '../../product-registry/contracts/product.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Hook families (the 6 canonical creative archetypes)
 * ──────────────────────────────────────────────────────────────────────── */

/** The canonical hook archetypes. Per MJB primitive 28, every generated
 *  hook is tagged with one of these families so performance-loop can
 *  correlate family with CTR / watch-time / conversion. Adding a family
 *  is a breaking change; existing concepts retain the old tag. */
export const HookFamilySchema = z.enum([
  'problem-reveal',
  'discovery',
  'comparison',
  'before-after',
  'routine-upgrade',
  'gift',
]);
export type HookFamily = z.infer<typeof HookFamilySchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Concept kinds (the surface a concept renders into)
 * ──────────────────────────────────────────────────────────────────────── */

/** What kind of creative asset this concept represents. Drives which API
 *  route generated it and which downstream consumer reads it. Hooks and
 *  captions are short text; scripts and angles are paragraph-length;
 *  storyboard concepts reference a separate StoryboardSchema by id. */
export const ConceptKindSchema = z.enum([
  'hook',
  'script',
  'angle',
  'lifestyle',
  'caption',
  'storyboard',
]);
export type ConceptKind = z.infer<typeof ConceptKindSchema>;

/** Named creative formats observed to convert. Per MJB primitive 26, the
 *  engine tags concepts using a known winning format so the dashboard can
 *  filter to "show me all 'wish-i-found-this-sooner' concepts across the
 *  catalog". `none` means the LLM did not match a named format. */
export const NamedConceptFormatSchema = z.enum([
  'why-i-bought-this',
  'wish-i-found-this-sooner',
  'none',
]);
export type NamedConceptFormat = z.infer<typeof NamedConceptFormatSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Concept — the central creative-asset row
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * One generated creative concept attached to a Product. Stored row-by-row
 * (not bundled into a Product) because a single product accrues many
 * concepts across iterations + perf feedback loops. The row carries
 * enough provenance (model, costRecordedRef, generatedAt) to support
 * primitive 92's monthly rollups without a follow-up join.
 *
 * `authenticityPassed` is set by the gate, NOT by the generator. A concept
 * that has not been gated yet is illegal to persist — the service layer
 * MUST gate before INSERT.
 */
export const ConceptSchema = z.object({
  conceptId: z.string().uuid(),
  productId: ProductIdSchema,
  kind: ConceptKindSchema,
  /** Required for `kind='hook'`; optional for other kinds (a script may
   *  embed a hook of a particular family but the row's primary kind is
   *  'script'). */
  hookFamily: HookFamilySchema.optional(),
  /** The generated copy. For `kind='storyboard'`, this is a short title /
   *  summary; the full shot list lives in `StoryboardSchema`. */
  content: z.string().min(1),
  namedFormat: NamedConceptFormatSchema.optional(),
  brandLane: BrandLaneSchema,
  generatedAt: z.string().datetime(),
  /** Model identifier (e.g. 'deepseek-v4', 'deepseek-coder@v2'). Stored on
   *  the row so a model-version rollback does not lose attribution. */
  model: z.string(),
  /** Pointer to the cost-ledger entry that recorded this generation call.
   *  Optional because dry-run gate checks do not record cost. */
  costRecordedRef: z.string().optional(),
  authenticityPassed: z.boolean(),
});
export type Concept = z.infer<typeof ConceptSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Objection (problem + rebuttal pair)
 * ──────────────────────────────────────────────────────────────────────── */

/** A single objection-and-rebuttal pair for a Product. Per MJB primitive
 *  29, the engine generates 3 objections per /api/ugc/objections call.
 *  `intensity` is the model's (or operator's) estimate of how often the
 *  objection actually surfaces in comments — 0 = rare, 1 = nearly every
 *  audience encounter. Performance-loop may overwrite intensity with an
 *  observed value after a test cycle. */
export const ObjectionSchema = z.object({
  objectionId: z.string().uuid(),
  productId: ProductIdSchema,
  objection: z.string().min(1),
  rebuttal: z.string().min(1),
  intensity: z.number().min(0).max(1),
  brandLane: BrandLaneSchema,
  generatedAt: z.string().datetime(),
});
export type Objection = z.infer<typeof ObjectionSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Storyboard (shot list)
 * ──────────────────────────────────────────────────────────────────────── */

/** A single shot in a storyboard. `durationSec` is the model's target —
 *  the editor / shooter may revise. `onScreenText` is optional text-overlay
 *  copy (a hook displayed on screen, a CTA, a price tag). */
export const StoryboardShotSchema = z.object({
  shotNo: z.number().int().positive(),
  durationSec: z.number().positive(),
  visualDescription: z.string().min(1),
  audioDirection: z.string().min(1),
  onScreenText: z.string().optional(),
});
export type StoryboardShot = z.infer<typeof StoryboardShotSchema>;

/** A storyboard for a Product. Optionally tied to a specific script (when
 *  the storyboard was generated FROM that script via POST /api/ugc/storyboard
 *  with a scriptId). `totalDurationSec` is the sum across shots — kept on
 *  the parent row so the dashboard can filter "show me 15-second storyboards"
 *  without scanning every shot. */
export const StoryboardSchema = z.object({
  storyboardId: z.string().uuid(),
  productId: ProductIdSchema,
  /** When set, the storyboard was generated from this Concept (kind='script'). */
  scriptId: z.string().uuid().optional(),
  shots: z.array(StoryboardShotSchema).min(1),
  totalDurationSec: z.number().positive(),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Authenticity check (THE GATE — per MJB primitive 64)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * The 5-question authenticity gate result for a single concept. Persisted
 * separately from the Concept row so a concept can be re-gated (e.g. after
 * a brand-lane policy update) without losing the prior check's reasoning.
 *
 * Decision rule:
 *   - PASS only if q1..q4 are ALL false AND q5 is true.
 *   - REJECT if ANY of q1..q4 is true OR q5 is false.
 *
 * `reasons[]` carries human-readable explanations indexed against the
 * questions that failed — content-dashboard renders these to the operator
 * so the rejection is auditable.
 */
export const AuthenticityCheckSchema = z.object({
  checkId: z.string().uuid(),
  /** `conceptId` of the Concept (or Objection, Storyboard) being gated. */
  conceptRef: z.string().uuid(),
  brandLane: BrandLaneSchema,
  questions: z.object({
    /** TRUE = concept fabricates a testimonial (e.g. "Sarah from Texas said..."). */
    q1FakeTestimonial: z.boolean(),
    /** TRUE = concept claims personal use the creator did not actually have. */
    q2FakePersonalUse: z.boolean(),
    /** TRUE = concept makes a medical, safety, or financial claim. */
    q3MedicalSafetyFinancialClaim: z.boolean(),
    /** TRUE = concept cites unverifiable specificity ("9 out of 10 doctors"). */
    q4UnverifiableSpecificity: z.boolean(),
    /** TRUE = concept matches the brand lane's tone / voice / audience policy. */
    q5BrandLaneFit: z.boolean(),
  }),
  decision: z.enum(['pass', 'reject']),
  /** Human-readable reasons — one per failed question (or one summary line
   *  for a pass). Operators review these in the dashboard. */
  reasons: z.array(z.string()).default([]),
  checkedAt: z.string().datetime(),
});
export type AuthenticityCheck = z.infer<typeof AuthenticityCheckSchema>;
