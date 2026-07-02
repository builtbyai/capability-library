/**
 * funnel-builder contracts — bus events.
 *
 * Every event declared in `manifest.yaml provides.events[]` has a typed
 * zod schema here. Page lifecycle events embed the full `FunnelPage` row
 * so dashboards can render without a follow-up fetch; link-health events
 * embed the `LinkHealth` row so social-distribution's pre-flight can
 * decide without re-probing.
 *
 * Companion: see `./funnel.js` for FunnelPage, Template, TrackingLink,
 * OptinCapture, LinkHealth, and the lifecycle / status enums.
 */
import { z } from 'zod';

import {
  FunnelPageSchema,
  LinkHealthSchema,
  OptinCaptureSchema,
  TrackingLinkSchema,
} from './funnel.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Page lifecycle events (draft -> published -> unpublished)
 *
 * `funnel.page.created` fires after the row lands in `draft`. The publish
 * and unpublish events fire AFTER the cloudflare-deploy round-trip
 * succeeds — never on the optimistic local state change.
 * ──────────────────────────────────────────────────────────────────────── */

export const FunnelPageCreatedSchema = z.object({
  event: z.literal('funnel.page.created'),
  page: FunnelPageSchema,
});
export type FunnelPageCreated = z.infer<typeof FunnelPageCreatedSchema>;

export const FunnelPagePublishedSchema = z.object({
  event: z.literal('funnel.page.published'),
  page: FunnelPageSchema,
  /** Convenience: the URL the page is reachable at (mirrors `page.publishedUrl`
   *  but flat so subscribers can index without a deep read). */
  publishedUrl: z.string().url(),
});
export type FunnelPagePublished = z.infer<typeof FunnelPagePublishedSchema>;

export const FunnelPageUnpublishedSchema = z.object({
  event: z.literal('funnel.page.unpublished'),
  page: FunnelPageSchema,
  reason: z.string().min(1),
});
export type FunnelPageUnpublished = z.infer<typeof FunnelPageUnpublishedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Opt-in capture
 *
 * Fires after the OptinCapture row is persisted (the PII payload itself
 * lives in intake-pipeline; this event carries the typed metadata row).
 * Downstream consumers: notify (welcome-email job), content-dashboard
 * (lead-queue render), performance-loop (opt-in-rate-per-page rollup).
 * ──────────────────────────────────────────────────────────────────────── */

export const FunnelOptinCapturedSchema = z.object({
  event: z.literal('funnel.optin.captured'),
  optin: OptinCaptureSchema,
});
export type FunnelOptinCaptured = z.infer<typeof FunnelOptinCapturedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Tracking link minted
 *
 * Fires after a TrackingLink row lands. Performance-loop subscribes to
 * pre-index the link so click events arriving via the redirector can be
 * attributed without a join.
 * ──────────────────────────────────────────────────────────────────────── */

export const FunnelTrackingLinkMintedSchema = z.object({
  event: z.literal('funnel.tracking-link.minted'),
  link: TrackingLinkSchema,
});
export type FunnelTrackingLinkMinted = z.infer<typeof FunnelTrackingLinkMintedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Link-health transitions
 *
 * `funnel.link.broken-detected` fires on EVERY probe that returns a
 * non-`ok` status (so social-distribution can react immediately at the
 * next pre-flight); `funnel.link.repaired` fires only on the
 * `broken -> ok` transition (not on every healthy probe). The capability
 * holds enough prior-status state to know which transition it is on.
 * ──────────────────────────────────────────────────────────────────────── */

export const FunnelLinkBrokenDetectedSchema = z.object({
  event: z.literal('funnel.link.broken-detected'),
  health: LinkHealthSchema,
});
export type FunnelLinkBrokenDetected = z.infer<typeof FunnelLinkBrokenDetectedSchema>;

export const FunnelLinkRepairedSchema = z.object({
  event: z.literal('funnel.link.repaired'),
  health: LinkHealthSchema,
  /** Prior health status before this probe flipped to 'ok'. Lets
   *  subscribers detect "was a 5xx, now ok" without lookup. */
  priorStatus: LinkHealthSchema.shape.status,
});
export type FunnelLinkRepaired = z.infer<typeof FunnelLinkRepairedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Event name registry
 * ──────────────────────────────────────────────────────────────────────── */

export const EVENT_NAMES = {
  pageCreated: 'funnel.page.created',
  pagePublished: 'funnel.page.published',
  pageUnpublished: 'funnel.page.unpublished',
  optinCaptured: 'funnel.optin.captured',
  trackingLinkMinted: 'funnel.tracking-link.minted',
  linkBrokenDetected: 'funnel.link.broken-detected',
  linkRepaired: 'funnel.link.repaired',
} as const;
