/**
 * funnel-builder canonical shapes.
 *
 * This capability renders storefront / landing / waitlist / collection /
 * link-in-bio pages from Product JSON (product-registry) + a registered
 * Template + a brand skin, deploys via cloudflare-deploy, captures opt-ins,
 * mints tracking links, and runs link-health probes. The shapes in this
 * file are the cross-capability contract:
 *
 *   - social-distribution reads `FunnelPage.publishedUrl` to attach to a
 *     scheduled post and consumes `LinkHealth` rows in its pre-flight gate.
 *   - intake-pipeline persists OptinCapture rows (the email/phone payload
 *     is high-trust PII; storage is the intake-pipeline's job, not ours).
 *   - performance-loop correlates `TrackingLink.hits` deltas against
 *     posted creative to compute per-Concept conversion.
 *
 * Template versioning is load-bearing: a published FunnelPage references
 * the template version it was rendered against (via `Template.version`
 * embedded in the page's deployment manifest). Editing a Template bumps
 * the version; existing pages do NOT automatically re-render — the
 * `funnel-builder:republish-on-product-update` job is the deliberate
 * trigger.
 *
 * Sibling files:
 *   - `events.ts` — typed bus event schemas.
 *   - `index.ts`  — barrel re-export.
 */
import { z } from 'zod';

import {
  BrandLaneSchema,
  ProductIdSchema,
} from '../../product-registry/contracts/product.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Template — the reusable HTML skeleton + field bindings
 * ──────────────────────────────────────────────────────────────────────── */

/** The five canonical funnel surfaces. Each maps to a different render
 *  intent: `storefront` lists multiple products, `landing` is one product +
 *  one CTA, `waitlist` collects pre-launch opt-ins, `collection` rolls up
 *  by tag/category, `link-in-bio` is the IG/TikTok bio menu. */
export const TemplateKindSchema = z.enum([
  'storefront',
  'landing',
  'waitlist',
  'collection',
  'link-in-bio',
]);
export type TemplateKind = z.infer<typeof TemplateKindSchema>;

/**
 * A registered reusable page template. `htmlSkeleton` is a Mustache- /
 * Handlebars-style template with `{{variable}}` slots; `fieldBindings`
 * declares which Product field path each variable resolves from
 * (e.g. `{ "productName": "name", "ctaPrice": "pricing.displayPriceUsd" }`).
 *
 * `version` is the breaking-change axis: any change to `htmlSkeleton` or
 * `fieldBindings` MUST bump version. Published pages capture the version
 * they rendered against — re-rendering against a new version requires the
 * republish job. The repository is the source of truth for the catalog of
 * templates; ad-hoc one-off pages can also be created without registering.
 */
export const TemplateSchema = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1),
  kind: TemplateKindSchema,
  brandLane: BrandLaneSchema,
  /** Semver-ish ('v1.0.0'). Bump on every breaking change to skeleton or
   *  bindings. Patch bumps are reserved for non-breaking copy/style edits. */
  version: z.string().min(1),
  /** Mustache- / Handlebars-style template body. The renderer does not
   *  enforce a specific engine here — the contract is "string with
   *  `{{variable}}` slots resolved via `fieldBindings`". */
  htmlSkeleton: z.string().min(1),
  /** Map of template variable -> Product field path. The renderer walks
   *  the path on the Product and substitutes. Unknown paths render as
   *  empty string (NOT an error, but logged by diagnostics). */
  fieldBindings: z.record(z.string()),
  createdAt: z.string().datetime(),
});
export type Template = z.infer<typeof TemplateSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * FunnelPage — the rendered, deployable page row
 * ──────────────────────────────────────────────────────────────────────── */

/** Page lifecycle. `draft` is the default after creation; `published` is
 *  set after the cloudflare-deploy round-trip succeeds; `unpublished` is
 *  reachable from `published` and means the page is no longer live (the
 *  deployment was removed). Transitions: draft -> published, published ->
 *  unpublished, unpublished -> published (re-publish without re-create). */
export const FunnelPageStatusSchema = z.enum(['draft', 'published', 'unpublished']);
export type FunnelPageStatus = z.infer<typeof FunnelPageStatusSchema>;

/**
 * A FunnelPage is one rendered Page row tied to one Product, one Template,
 * and one brand lane. `publishedUrl` and `deploymentId` are populated by
 * the publish action (after cloudflare-deploy emits a successful
 * `deployment.published`). When `status='unpublished'`, both fields stay
 * populated as historical pointers so subsequent re-publish can re-use
 * the deployment slot.
 */
export const FunnelPageSchema = z.object({
  pageId: z.string().uuid(),
  productId: ProductIdSchema,
  templateId: z.string().uuid(),
  brandLane: BrandLaneSchema,
  status: FunnelPageStatusSchema,
  /** Set on first successful publish; persisted across unpublish cycles. */
  publishedUrl: z.string().url().optional(),
  /** Set on first successful publish; references cloudflare-deploy's
   *  deployment row. Persisted across unpublish cycles so re-publish can
   *  re-use the slot. */
  deploymentId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
});
export type FunnelPage = z.infer<typeof FunnelPageSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * TrackingLink — short URL + UTM payload + denormalized hit counter
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * A mintable short link with a fixed UTM payload. `shortCode` is the slug
 * served by the click-redirect surface (the redirector is part of this
 * capability's runtime; the click handler increments `hits` and writes a
 * separate click-event row for `GET /tracking-links/:linkId/clicks` to
 * aggregate from). `pageId` is optional — links can point at any
 * destination, not just funnel pages we own.
 *
 * UTM convention (MJB primitive 89): `source` is the platform slug
 * (`tiktok`, `instagram`, `youtube`), `medium` is the format
 * (`organic`, `paid`, `bio`, `dm`), `campaign` is the brand-lane +
 * product slug (`lane_home_kitchen__prod_abc123`), `content` is the
 * Concept id when the link was minted for a specific creative. Performance-
 * loop joins on `campaign` + `content` to attribute conversion.
 */
export const TrackingLinkSchema = z.object({
  linkId: z.string().uuid(),
  shortCode: z.string().min(1),
  pageId: z.string().uuid().optional(),
  productId: ProductIdSchema,
  brandLane: BrandLaneSchema,
  destinationUrl: z.string().url(),
  utm: z.object({
    source: z.string().min(1),
    medium: z.string().min(1),
    campaign: z.string().min(1),
    content: z.string().optional(),
  }),
  mintedAt: z.string().datetime(),
  /** Optional expiry — the redirector returns 410 Gone after this time. */
  expiresAt: z.string().datetime().optional(),
  /** Denormalized click counter. Authoritative count lives in the
   *  click-event table; this field is a fast-path for list views. */
  hits: z.number().int().nonnegative().default(0),
});
export type TrackingLink = z.infer<typeof TrackingLinkSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * OptinCapture — the lead row written when a page form submits
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Consent payload (MJB primitive 57). The page MUST surface a consent
 * checkbox referencing `policyVersion`; the submission MUST carry
 * `consentedAt`. Storing the policy version (not just "yes/no") lets the
 * compliance review reconstruct WHAT the user consented to at the time of
 * the opt-in even after the policy is revised. Consent without these
 * fields is a contract violation — the schema enforces both.
 */
export const ConsentSchema = z.object({
  policyVersion: z.string().min(1),
  consentedAt: z.string().datetime(),
});
export type Consent = z.infer<typeof ConsentSchema>;

/**
 * One opt-in row captured from a page form. `contact` must carry at least
 * one of `email` or `phone` (the schema does not enforce — service layer
 * enforces, and rejects empty-contact rows). `source` says which channel
 * the visitor opted in for: 'email', 'sms', or 'both'. Persistence is via
 * intake-pipeline (the email/phone is PII; intake-pipeline owns durable
 * blob storage); this row is the typed metadata layer.
 */
export const OptinCaptureSchema = z.object({
  optinId: z.string().uuid(),
  pageId: z.string().uuid(),
  productId: ProductIdSchema,
  brandLane: BrandLaneSchema,
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    name: z.string().optional(),
  }),
  source: z.enum(['email', 'sms', 'both']),
  consent: ConsentSchema,
  capturedAt: z.string().datetime(),
});
export type OptinCapture = z.infer<typeof OptinCaptureSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * LinkHealth — probe result (consumed by social-distribution's pre-flight)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Result of one link-health probe. The probe runs on a schedule via
 * `funnel-builder:health-probe` and also on-demand via `GET /api/funnel/health`.
 *
 * Status taxonomy:
 *   - `ok`            — 2xx response within timeout
 *   - `redirect-loop` — exceeded max-redirects
 *   - `dns-fail`      — name resolution failed
 *   - `tls-fail`      — TLS handshake failed
 *   - `timeout`       — request timed out
 *   - `4xx`           — 400-499 status code (also fills `statusCode`)
 *   - `5xx`           — 500-599 status code (also fills `statusCode`)
 *
 * Any non-`ok` status fires `funnel.link.broken-detected`. When a probe
 * after a previously broken link returns `ok`, the capability fires
 * `funnel.link.repaired`. Social-distribution refuses to publish a post
 * whose attached link is in a broken state at pre-flight time.
 */
export const LinkHealthSchema = z.object({
  linkId: z.string().uuid(),
  status: z.enum([
    'ok',
    'redirect-loop',
    'dns-fail',
    'tls-fail',
    'timeout',
    '4xx',
    '5xx',
  ]),
  checkedAt: z.string().datetime(),
  /** Populated for `4xx` and `5xx` statuses; omitted for transport errors. */
  statusCode: z.number().int().optional(),
  /** Wall-clock latency in milliseconds. Omitted when no response arrived. */
  latencyMs: z.number().int().nonnegative().optional(),
});
export type LinkHealth = z.infer<typeof LinkHealthSchema>;
