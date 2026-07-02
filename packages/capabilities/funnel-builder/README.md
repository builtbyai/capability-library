# funnel-builder

L2 MJB capability. Renders storefront, landing, waitlist, collection, and link-in-bio pages from a `Product` (from `product-registry`) + a registered `Template` + a brand skin, deploys via `cloudflare-deploy`, captures email/SMS opt-ins, mints tracking links with UTM conventions, and runs link-health probes that `social-distribution`'s pre-flight gate consumes.

Status: `planned` (contracts-only scaffold). No service code yet.

## What it is

A capability that owns the "post-product, pre-traffic" surface — every link in a bio, every landing page behind a TikTok video, every collection roll-up under a brand-lane. The render pipeline is template-driven (`TemplateSchema` declares the HTML skeleton + Product-field bindings), the deploy pipeline is `cloudflare-deploy` (this capability does not host pages itself), and every page tracks its own URL + deployment id so re-publish reuses the slot.

The capability also owns the **tracking-link mint** (`TrackingLinkSchema` + a redirector surface that increments `hits`) and the **link-health probe** (`LinkHealthSchema` + a scheduled job). Both feed downstream: `performance-loop` reads click telemetry; `social-distribution` reads link health at pre-flight.

## Why this is separate from `cloudflare-deploy`

`cloudflare-deploy` is a thin platform adapter — given a built bundle, it pushes to Pages / Workers, watches the build, emits `deployment.published`. `funnel-builder` is a domain capability — given a Product + a Template kind, it builds a page worth deploying. Mixing the two would make `cloudflare-deploy` Product-aware, which it shouldn't be. Funnel-builder calls cloudflare-deploy; cloudflare-deploy does not know what a funnel is.

## Why this is separate from `intake-pipeline`

`intake-pipeline` is the universal byte store — it durably persists the email/phone PII payload of an `OptinCapture` (per primitive 57 / GDPR consent storage shape). `funnel-builder` owns the typed metadata row (`OptinCaptureSchema`) and the page surface that captured it, but it does NOT own the PII storage. The two compose: the `OptinCapture.contact` block is the row, the actual blob (e.g. a normalized lead JSON with normalized phone format) lives in intake-pipeline keyed by `optinId`.

## Template versioning + republish-on-update

`TemplateSchema.version` is the breaking-change axis. Any change to `htmlSkeleton` or `fieldBindings` MUST bump version. A published `FunnelPage` captures the template version it was rendered against (in its deployment manifest, not on the row — the row points at `templateId`, the version is in the deployment artifact).

**Editing a Template does NOT auto-rerender existing pages.** The `funnel-builder:republish-on-product-update` job is the deliberate trigger — it subscribes to `product.updated` (from `product-registry`) and to operator-initiated "republish all pages on template vN" actions. Auto-rerender on every template edit would multiply traffic spikes (every kitchen brand page rebuilding at once when the storefront template's footer changes); the deliberate job spreads the work.

The job's contract:

1. Fetch all `FunnelPage` rows where `templateId = X` and `status = 'published'`.
2. For each, re-render against the current `Template.version` and call `cloudflare-deploy` to push.
3. `publishedUrl` and `deploymentId` stay stable (the slot is reused).
4. Emit `funnel.page.published` again (subscribers re-index against the new version).

## UTM convention (MJB primitive 89)

`TrackingLinkSchema.utm` is the join key for `performance-loop`. The convention:

| Field | Value example | Meaning |
|---|---|---|
| `source` | `tiktok`, `instagram`, `youtube`, `dm`, `email` | The traffic platform |
| `medium` | `organic`, `paid`, `bio`, `dm` | Format on that platform |
| `campaign` | `lane_home_kitchen__prod_abc123def456` | Brand-lane + Product (the cohort) |
| `content` | `<conceptId>` | The Concept the link was minted for (when applicable) |

`performance-loop` joins click events on `campaign` + `content` to attribute conversion to a specific creative. If `content` is omitted, attribution is product-level only — that is allowed (link-in-bio links are not concept-specific) but downstream rollups lose creative granularity.

## Consent storage (MJB primitive 57)

`OptinCaptureSchema.consent` is REQUIRED and has two non-optional fields: `policyVersion` and `consentedAt`. The page form MUST surface a checkbox referencing the current policy version; the submit handler MUST record both fields. Storing the policy *version* (not just "yes/no") is what makes the consent legally auditable — a regulator asking "what did this user actually consent to in 2026-04" can reconstruct from the policy archive + the version pointer.

A submission missing `consent` is REJECTED at the service layer (the schema enforces structure; the rejection is the policy enforcement). Empty contact (no `email` AND no `phone`) is also rejected — those are bot submissions.

## Link-health probe drives social-distribution pre-flight (MJB primitive 90)

The `funnel-builder:health-probe` job runs on a schedule (default 5 min for active campaigns, 1 hr for archived). Every probe writes a `LinkHealthSchema` row. Status transitions:

- **Any non-`ok` status -> `funnel.link.broken-detected`** (every time, not just on first detection). Social-distribution's pre-flight queries link health and refuses to post a creative whose attached link is currently broken.
- **`broken -> ok` -> `funnel.link.repaired`** (only on the transition, not on every healthy probe). Subscribers can clear "broken link" alarms without polling.

The pre-flight check is REAL-TIME (it calls the probe synchronously) for high-stakes actions (publishing a paid ad) and CACHED (last-known-status) for low-stakes (scheduling an organic post). The cache TTL is short enough that a 5xx outage rarely escapes.

## Sharp edges

- **Template versioning is load-bearing.** Editing a Template without bumping `version` will not trigger republish-on-update and existing pages will drift silently. Make `version` required and document the bump cadence in `docs/template-versioning.md`.
- **Auto-rerender is OFF by default.** Every Template edit creates a queue, not a stampede. Republish is the deliberate operator action (or a scheduled batch); never trigger on every Template PATCH.
- **OptinCapture PII does NOT live on the row.** The typed metadata (timing, source, page) is here; the actual normalized contact blob persists in intake-pipeline. Do not denormalize email/phone into long-term storage without intake-pipeline's lifecycle hooks.
- **Consent without `policyVersion` is a contract violation.** Schema enforces the presence; service layer must NOT allow a submission to bypass even when "test mode" is on.
- **TrackingLink `shortCode` collisions are a service-layer concern.** The schema does not enforce uniqueness; the redirector + DB constraint does. A collision returns 409 at mint time; do not silently mutate the requested shortCode.
- **`hits` is denormalized; click-events are authoritative.** Use the click-event table for analytics, the row counter for list views. Reconciliation is a scheduled job; small drift is acceptable.
- **Link-health probe must not loop on its own redirector.** The probe MUST follow redirects and check the final URL, but if the destination IS a tracking-link, the probe should resolve to the underlying destination, not bounce off the shortCode handler again.
- **Unpublish preserves `publishedUrl` + `deploymentId`.** Both stay populated so re-publish can re-use the slot. Do not nullify them on unpublish.
- **Republish-on-update job is hand-on-the-throttle.** It fires on `product.updated` (from product-registry), but only for fields the template actually binds to. Re-rendering 10,000 pages because a `metadata.notes` field changed is wasted work; filter on the intersection of `event.changed[]` and `Template.fieldBindings` values.

## Build status checklist

- [x] `manifest.yaml`
- [x] `contracts/funnel.ts` (Template, FunnelPage, TrackingLink, OptinCapture, LinkHealth)
- [x] `contracts/events.ts` (all 7 events typed)
- [x] `contracts/index.ts` (barrel)
- [x] `README.md` (this file)
- [x] `tests/contracts.test.ts` (vitest, schema parse coverage)
- [ ] `docs/diagnostics.runbook.md` (referenced from manifest; follow-up)
- [ ] `docs/sharp-edges.md` (per capability standard; follow-up)
- [ ] `docs/template-versioning.md` (when first Template version bumps in production)
- [ ] Service / router code (none yet — contracts-only scaffold)
- [ ] Redirector surface (shortCode handler + click-event writer)
- [ ] Link-health probe implementation
