/**
 * ugc-concept-engine contracts — bus events.
 *
 * Every event declared in `manifest.yaml provides.events[]` has a typed
 * zod schema here. Concept-creation events embed the full Concept (or
 * Objection / Storyboard) row so downstream consumers (content-dashboard,
 * social-distribution) do not need a follow-up fetch to render. The
 * `ugc.authenticity.rejected` event carries the AuthenticityCheck reasons
 * inline so an operator queue can render the rejection without joining.
 *
 * Companion: see `./concept.js` for Concept, Objection, Storyboard,
 * AuthenticityCheck, HookFamily, and ConceptKind.
 */
import { z } from 'zod';

import {
  AuthenticityCheckSchema,
  ConceptSchema,
  ObjectionSchema,
  StoryboardSchema,
} from './concept.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Concept creation events
 *
 * Each kind has its own event so subscribers can filter cheaply. The
 * payload always carries the full Concept (or Objection / Storyboard) row
 * the engine just persisted — and `authenticityPassed === true` is
 * INVARIANT on every creation event (rejections fire the dedicated
 * `ugc.authenticity.rejected` instead and never produce a Concept row).
 * ──────────────────────────────────────────────────────────────────────── */

export const UgcHookCreatedSchema = z.object({
  event: z.literal('ugc.hook.created'),
  concept: ConceptSchema,
});
export type UgcHookCreated = z.infer<typeof UgcHookCreatedSchema>;

export const UgcScriptCreatedSchema = z.object({
  event: z.literal('ugc.script.created'),
  concept: ConceptSchema,
});
export type UgcScriptCreated = z.infer<typeof UgcScriptCreatedSchema>;

export const UgcObjectionCreatedSchema = z.object({
  event: z.literal('ugc.objection.created'),
  objection: ObjectionSchema,
});
export type UgcObjectionCreated = z.infer<typeof UgcObjectionCreatedSchema>;

export const UgcCaptionCreatedSchema = z.object({
  event: z.literal('ugc.caption.created'),
  concept: ConceptSchema,
});
export type UgcCaptionCreated = z.infer<typeof UgcCaptionCreatedSchema>;

export const UgcStoryboardCreatedSchema = z.object({
  event: z.literal('ugc.storyboard.created'),
  storyboard: StoryboardSchema,
});
export type UgcStoryboardCreated = z.infer<typeof UgcStoryboardCreatedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Authenticity rejection (the gate fired and refused to persist)
 *
 * This event is the ONLY signal that a candidate concept was generated
 * but failed the 5-question gate. Content-dashboard subscribes to surface
 * rejections in an operator review queue; performance-loop subscribes to
 * count rejection rates by brand-lane (a high reject rate is a brand-lane
 * voice-policy drift signal).
 *
 * `candidateContent` carries the rejected text so the operator can audit
 * the LLM's behavior without losing the artifact — there is no persisted
 * Concept row for a rejection. `check.decision` is ALWAYS 'reject'.
 * ──────────────────────────────────────────────────────────────────────── */

export const UgcAuthenticityRejectedSchema = z.object({
  event: z.literal('ugc.authenticity.rejected'),
  /** What was generated but never persisted. */
  candidateContent: z.string().min(1),
  check: AuthenticityCheckSchema,
});
export type UgcAuthenticityRejected = z.infer<typeof UgcAuthenticityRejectedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Event name registry
 * ──────────────────────────────────────────────────────────────────────── */

export const EVENT_NAMES = {
  hookCreated: 'ugc.hook.created',
  scriptCreated: 'ugc.script.created',
  objectionCreated: 'ugc.objection.created',
  captionCreated: 'ugc.caption.created',
  authenticityRejected: 'ugc.authenticity.rejected',
  storyboardCreated: 'ugc.storyboard.created',
} as const;
