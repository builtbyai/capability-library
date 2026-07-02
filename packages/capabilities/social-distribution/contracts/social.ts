/**
 * social-distribution canonical shapes.
 *
 * L2 MJB capability that fans a single "publishable" Product out to all
 * configured platform connectors after the 7-point pre-flight checklist
 * passes. The PRE-FLIGHT and the BRAND-LANE FIREWALL are the two non-
 * negotiable gates here:
 *
 *   1. PRE-FLIGHT — all 7 checks must pass before a post leaves
 *      'preflight-pending'. Any `blockerSeverity='blocker'` failure flips
 *      the post to 'preflight-failed' (terminal until operator action).
 *      `warn` failures surface in the result but do not block.
 *
 *   2. BRAND-LANE FIREWALL (MJB primitives 79-80) — the per-platform
 *      connector account used to publish MUST be bound to the product's
 *      `brandLane`. A connector that is not bound to the product's lane
 *      causes `social.lane.violation.blocked` and the post is never
 *      attempted. `LaneViolationSchema` is APPEND-ONLY audit; the violated
 *      post CANNOT be retried — the operator must either (a) re-bind the
 *      connector, (b) re-assign the product's brandLane, or (c) cancel.
 *      This is the "no audience bleed across brands" guarantee.
 *
 * Cross-capability reads:
 *   - `product-registry` — source of `brandLane`, `mediaRefs`, `creativeWinners`
 *   - `funnel-builder`   — source of `trackingLinkId` (we never accept
 *                          arbitrary third-party shortener URLs)
 *   - `connector-config` — per-platform account credentials + the
 *                          lane-binding registry
 *
 * Sibling files:
 *   - `events.ts` — typed bus events
 *   - `index.ts`  — barrel
 */
import { z } from 'zod';

import { BrandLaneSchema } from '../../product-registry/contracts/product.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Platforms
 * ──────────────────────────────────────────────────────────────────────── */

/** The 8 distribution surfaces supported. Each requires its own connector
 *  in `connector-config` and its own bound lane (see `LaneConnectorBindingSchema`).
 *  `tiktok` is the organic feed; `tiktok-shop` is the affiliate/PSP product
 *  surface — they are intentionally separate because they have different TOS
 *  + connector shapes + per-post spec compliance rules. */
export const PlatformSchema = z.enum([
  'tiktok',
  'tiktok-shop',
  'instagram-reels',
  'instagram-stories',
  'facebook-feed',
  'pinterest',
  'linkedin',
  'youtube-shorts',
]);
export type Platform = z.infer<typeof PlatformSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Pre-flight (the 7-point checklist)
 * ──────────────────────────────────────────────────────────────────────── */

/** Names of the 7 pre-flight checks. Closed set — adding an 8th is a
 *  contract change requiring a coordinated update across consumers. */
export const PreflightCheckNameSchema = z.enum([
  'brand-lane-bound',
  'content-authenticity-passed',
  'funnel-link-healthy',
  'tracking-utm-set',
  'platform-spec-compliant',
  'rate-limit-headroom',
  'tos-risk-acceptable',
]);
export type PreflightCheckName = z.infer<typeof PreflightCheckNameSchema>;

/** One result row in the checklist. `evidence` is a short human-readable
 *  string (e.g. "connector cn_xyz bound to lane_outdoors at 2026-06-20").
 *  `blockerSeverity` only meaningful when `passed=false` — 'blocker' flips
 *  the parent `PreflightResultSchema.decision` to 'fail'; 'warn' is a
 *  reportable miss that does NOT block publishing. */
export const PreflightCheckSchema = z.object({
  checkName: PreflightCheckNameSchema,
  passed: z.boolean(),
  evidence: z.string().optional(),
  blockerSeverity: z.enum(['warn', 'blocker']).optional(),
});
export type PreflightCheck = z.infer<typeof PreflightCheckSchema>;

/** Result of a single pre-flight run against a candidate post. The result
 *  is replayed on the parent `SocialPostSchema.preflightResult` and also
 *  emitted as `social.preflight.passed` / `social.preflight.failed` for
 *  observability. If `decision='fail'`, `failedAt` names the first failing
 *  check with `blockerSeverity='blocker'`. */
export const PreflightResultSchema = z.object({
  checkedAt: z.string().datetime(),
  /** Loose ref because pre-flight can be dry-run before a post id is
   *  assigned (the POST /api/social/preflight surface). */
  postRef: z.string(),
  checks: z.array(PreflightCheckSchema).min(1),
  decision: z.enum(['pass', 'fail']),
  /** Set when `decision='fail'`. Names the first check whose `passed=false`
   *  AND `blockerSeverity='blocker'`. */
  failedAt: PreflightCheckNameSchema.optional(),
});
export type PreflightResult = z.infer<typeof PreflightResultSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Social post (the queued / publishing / published entity)
 * ──────────────────────────────────────────────────────────────────────── */

/** Concept refs roll up the three ugc-concept-engine emissions that, when
 *  ALL present for a product, make it publishable. `scriptId` is optional
 *  because some platforms (Pinterest, IG Stories) don't need a script. */
export const SocialConceptRefSchema = z.object({
  hookId: z.string(),
  captionId: z.string(),
  scriptId: z.string().optional(),
});
export type SocialConceptRef = z.infer<typeof SocialConceptRefSchema>;

/** Media to attach to the post. `intakeObjectId` resolves through
 *  intake-pipeline. A post may carry multiple media refs (carousel /
 *  multi-image platforms) — the per-platform spec check enforces what
 *  each surface actually accepts. */
export const SocialMediaRefSchema = z.object({
  kind: z.enum(['image', 'video']),
  intakeObjectId: z.string(),
});
export type SocialMediaRef = z.infer<typeof SocialMediaRefSchema>;

/** A single published surface record. One `SocialPostSchema` accrues one
 *  of these per platform once that platform's publish completes. */
export const SocialPublishedRefSchema = z.object({
  platform: PlatformSchema,
  platformPostId: z.string(),
  publishedAt: z.string().datetime(),
  url: z.string().url(),
});
export type SocialPublishedRef = z.infer<typeof SocialPublishedRefSchema>;

/** The queued / publishing / published Social post.
 *
 * STATE MACHINE:
 *   preflight-pending → (preflight pass)   → queued → publishing → published
 *                     ↘ (preflight fail blocker) → preflight-failed (terminal)
 *   queued / publishing → (operator)        → cancelled (terminal)
 *   publishing          → (platform error)  → failed (retryable via job)
 *
 * Note: a lane-violation does NOT live on this state machine — it is
 * intercepted BEFORE the post leaves 'queued' and recorded on
 * `LaneViolationSchema`. The post itself flips to 'failed' with a
 * lane-violation reason and is NOT retryable until the binding is fixed. */
export const SocialPostSchema = z.object({
  postId: z.string(),
  productId: z.string(),
  brandLane: BrandLaneSchema,
  platforms: z.array(PlatformSchema).min(1),
  scheduledFor: z.string().datetime().optional(),
  status: z.enum([
    'preflight-pending',
    'preflight-failed',
    'queued',
    'publishing',
    'published',
    'failed',
    'cancelled',
  ]),
  conceptRefs: SocialConceptRefSchema,
  mediaRefs: z.array(SocialMediaRefSchema).min(1),
  /** Tracking link MUST come from funnel-builder — we do not accept raw
   *  bit.ly / cuttly / etc. URLs. The id resolves through funnel-builder's
   *  GET /api/funnels/links/:id surface. */
  trackingLinkId: z.string(),
  preflightResult: PreflightResultSchema,
  publishedRefs: z.array(SocialPublishedRefSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SocialPost = z.infer<typeof SocialPostSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Lane → Connector binding (the firewall registry)
 * ──────────────────────────────────────────────────────────────────────── */

/** A binding row: this `brandLane` is allowed to publish to this `platform`
 *  via this `connectorId`. Without a binding, ANY publish attempt for that
 *  (lane, platform) pair raises a `LaneViolationSchema`. `audienceTag` is
 *  an optional secondary scope (per-platform audience id like an IG account
 *  business id or a TikTok Shop seller_id) that further narrows the route. */
export const LaneConnectorBindingSchema = z.object({
  brandLane: BrandLaneSchema,
  platform: PlatformSchema,
  connectorId: z.string(),
  audienceTag: z.string().optional(),
  boundAt: z.string().datetime(),
  boundBy: z.enum(['auto', 'operator']),
});
export type LaneConnectorBinding = z.infer<typeof LaneConnectorBindingSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Lane violation (audit row — NON-RETRYABLE)
 * ──────────────────────────────────────────────────────────────────────── */

/** Recorded every time a publish attempt would have violated the brand-lane
 *  firewall. APPEND-ONLY. The associated `SocialPost` is flipped to
 *  'failed' and CANNOT be auto-retried by the retry-failed job — the
 *  operator must explicitly intervene (re-bind the connector, re-assign
 *  the product's lane, or cancel the post). This non-retryability is
 *  intentional: silent retries are how audience-bleed accidents happen. */
export const LaneViolationSchema = z.object({
  violationId: z.string(),
  attemptedPostId: z.string(),
  brandLane: BrandLaneSchema,
  platform: PlatformSchema,
  connectorId: z.string(),
  reason: z.enum([
    'connector-not-bound-to-lane',
    'audience-mismatch',
    'lane-blocked-this-platform',
    'operator-paused',
  ]),
  detectedAt: z.string().datetime(),
});
export type LaneViolation = z.infer<typeof LaneViolationSchema>;
