/**
 * social-distribution contracts — bus events.
 *
 * Every event listed in `manifest.yaml provides.events[]` has a typed
 * schema here. The two events with the strongest invariants:
 *
 *   - `social.lane.violation.blocked` — emitted before any external API
 *     call when the brand-lane firewall (MJB primitives 79-80) catches a
 *     misrouted post. Consumers MUST treat this as terminal-for-this-post:
 *     do not auto-retry. The associated post is flipped to 'failed' and
 *     requires explicit operator action (re-bind / re-assign / cancel).
 *
 *   - `social.tos.bot-detection.triggered` — emitted when a platform
 *     surfaces a "are you a bot" challenge / captcha / unusual-activity
 *     pause. Consumers (notify, content-dashboard) should pause the
 *     affected connector across ALL queued posts, not just this one,
 *     until the operator clears it.
 */
import { z } from 'zod';

import {
  LaneViolationSchema,
  PlatformSchema,
  PreflightResultSchema,
  SocialPostSchema,
  SocialPublishedRefSchema,
} from './social.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Queue lifecycle
 * ──────────────────────────────────────────────────────────────────────── */

export const SocialPostQueuedSchema = z.object({
  event: z.literal('social.post.queued'),
  post: SocialPostSchema,
});
export type SocialPostQueued = z.infer<typeof SocialPostQueuedSchema>;

export const SocialPostPublishedSchema = z.object({
  event: z.literal('social.post.published'),
  postId: z.string(),
  productId: z.string(),
  publishedRef: SocialPublishedRefSchema,
});
export type SocialPostPublished = z.infer<typeof SocialPostPublishedSchema>;

export const SocialPostFailedSchema = z.object({
  event: z.literal('social.post.failed'),
  postId: z.string(),
  productId: z.string(),
  platform: PlatformSchema,
  reason: z.enum([
    'platform-api-error',
    'rate-limited',
    'media-rejected',
    'spec-noncompliant',
    'lane-violation',
    'tos-challenge',
    'unknown',
  ]),
  detail: z.string().optional(),
  /** `true` when retry-failed is allowed to pick this up. Always `false`
   *  for `reason='lane-violation'` and `reason='tos-challenge'`. */
  retryable: z.boolean(),
  failedAt: z.string().datetime(),
});
export type SocialPostFailed = z.infer<typeof SocialPostFailedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Pre-flight outcomes
 * ──────────────────────────────────────────────────────────────────────── */

export const SocialPreflightPassedSchema = z.object({
  event: z.literal('social.preflight.passed'),
  postId: z.string().optional(),
  result: PreflightResultSchema,
});
export type SocialPreflightPassed = z.infer<typeof SocialPreflightPassedSchema>;

export const SocialPreflightFailedSchema = z.object({
  event: z.literal('social.preflight.failed'),
  postId: z.string().optional(),
  result: PreflightResultSchema,
});
export type SocialPreflightFailed = z.infer<typeof SocialPreflightFailedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Lane violation (MJB primitive 80 enforcement)
 * ──────────────────────────────────────────────────────────────────────── */

/** Emitted when the brand-lane firewall catches a misrouted publish.
 *  Consumers MUST NOT auto-retry — see the schema doc on `LaneViolationSchema`. */
export const SocialLaneViolationBlockedSchema = z.object({
  event: z.literal('social.lane.violation.blocked'),
  violation: LaneViolationSchema,
});
export type SocialLaneViolationBlocked = z.infer<typeof SocialLaneViolationBlockedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Platform TOS / bot-detection signal
 * ──────────────────────────────────────────────────────────────────────── */

export const SocialTosBotDetectionTriggeredSchema = z.object({
  event: z.literal('social.tos.bot-detection.triggered'),
  platform: PlatformSchema,
  connectorId: z.string(),
  postId: z.string().optional(),
  /** Short tag describing what the platform did. */
  signal: z.enum([
    'captcha-challenge',
    'unusual-activity-pause',
    'rate-limit-burst',
    'account-restricted',
    'post-shadowbanned',
  ]),
  detail: z.string().optional(),
  detectedAt: z.string().datetime(),
});
export type SocialTosBotDetectionTriggered = z.infer<typeof SocialTosBotDetectionTriggeredSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Event name registry
 * ──────────────────────────────────────────────────────────────────────── */

export const EVENT_NAMES = {
  postQueued: 'social.post.queued',
  postPublished: 'social.post.published',
  postFailed: 'social.post.failed',
  preflightPassed: 'social.preflight.passed',
  preflightFailed: 'social.preflight.failed',
  laneViolationBlocked: 'social.lane.violation.blocked',
  tosBotDetectionTriggered: 'social.tos.bot-detection.triggered',
} as const;
