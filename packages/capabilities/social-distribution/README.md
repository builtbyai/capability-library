# social-distribution

L2 MJB capability. **Multi-platform post fan-out** across TikTok, TikTok Shop, Instagram Reels, Instagram Stories, Facebook Feed, Pinterest, LinkedIn, and YouTube Shorts — with a tracking link attached from `funnel-builder`, a non-bypassable 7-point pre-flight checklist, and the brand-lane firewall (MJB primitives 79-80) wired in as the publish gate of last resort.

Status: `planned` (contracts-only scaffold). No service code yet.

## What it is

A capability that owns one job: given a publishable Product (one that has all three of `ugc.hook.created`, `ugc.caption.created`, and `gen.asset.created` emitted against it), queue a post per requested platform, attach the right funnel-builder tracking link, run the 7-point pre-flight, and either publish through each platform's connector or refuse with a typed reason. It does **not** generate creative, generate media, build funnels, or score performance — those are upstream / downstream capabilities. It is the publish bridge.

## Why the 7-point pre-flight exists

Every check addresses a specific failure mode we have already observed somewhere in the MJB workflow:

| # | Check | Failure mode it catches |
|---|---|---|
| 1 | `brand-lane-bound` | The connector account about to publish isn't bound to the product's `brandLane` (primitive 80 — audience bleed). |
| 2 | `content-authenticity-passed` | The media we're about to post failed authenticity / watermark / spec validation upstream. |
| 3 | `funnel-link-healthy` | The funnel-builder tracking link 404s or 5xxs — we'd be sending traffic into a void. |
| 4 | `tracking-utm-set` | The link has a tracking id but no UTM tagging, so the performance loop can't attribute results back to this post. |
| 5 | `platform-spec-compliant` | The media doesn't match the target platform's hard limits (aspect ratio, duration, max file size, caption length). |
| 6 | `rate-limit-headroom` | This connector is one publish away from the platform's rate limit; pushing now would trigger a forced pause. |
| 7 | `tos-risk-acceptable` | Content type / hashtag set / link pattern matches a known TOS-risk signature for this platform. |

A `blockerSeverity='blocker'` failure on any check stops publishing. `warn` failures are surfaced in the result but do not block — they're for operator awareness.

## The brand-lane firewall is the most important rule in this capability

Per MJB primitives 79-80: **the per-platform connector account that publishes a product MUST be bound to that product's `brandLane`.** If it isn't, the firewall raises `social.lane.violation.blocked`, records a `LaneViolation`, flips the post to `failed`, and refuses to retry. This is the single hard rule that prevents private/professional audience bleed across brands — there is no `force=true` override surface, and the retry-failed job is explicitly forbidden from touching a post that failed for `reason='lane-violation'`. Operator action is required: re-bind the connector, re-assign the product's `brandLane`, or cancel the post.

`LaneConnectorBindingSchema` is the registry. A binding ties one `brandLane` to one `(platform, connectorId)` pair, with an optional `audienceTag` for platforms where one connector account can publish to multiple audiences (an IG Business account managing multiple IG accounts, a TikTok Shop seller managing multiple shops). `POST /api/social/lanes/:laneId/connectors` writes a binding; `GET` lists them.

## Tracking links come from funnel-builder, not third-party shorteners

`SocialPostSchema.trackingLinkId` resolves through `funnel-builder`. We do not accept arbitrary bit.ly / cuttly / etc. URLs in the post payload. This is deliberate: the performance-loop needs UTM-tagged, owned-domain redirects so click → ATC → purchase attribution can be reconstructed. The pre-flight checks (`funnel-link-healthy`, `tracking-utm-set`) enforce this.

## What "publishable" means

A product is publishable when **all three** of these have been emitted against it:

- `ugc.hook.created` — a written hook line is available
- `ugc.caption.created` — a caption is available
- `gen.asset.created` — at least one usable media asset exists

This capability subscribes to all three; it does not poll. When all three have landed for one `productId`, a "publishable" projection becomes true and the operator can fire `POST /api/social/posts`. The subscriber set is what lets the catalog stay event-driven instead of requiring a downstream scheduler to fan out polls.

## State machine

```
preflight-pending → (preflight pass)            → queued → publishing → published
                  ↘ (preflight fail blocker)    → preflight-failed (terminal)
queued / publishing → (operator cancel)         → cancelled (terminal)
publishing          → (platform error retryable)→ failed (auto retry via job)
publishing / queued → (lane violation)          → failed (NON-RETRYABLE — operator required)
publishing          → (TOS challenge)           → failed (NON-RETRYABLE — connector paused)
```

`failed` is the catch-all unhappy terminal that **may or may not** be retryable — `SocialPostFailedSchema.retryable` is the source of truth. Two cases (`lane-violation`, `tos-challenge`) are always `retryable=false`.

## Sharp edges

- **Lane violations cannot be bypassed.** The `social-distribution:retry-failed` job MUST filter out posts whose last failure was `reason='lane-violation'`. If a future refactor adds a `force=true` retry path, the firewall (primitive 80) is breached and we lose the cross-brand audience guarantee. There is no acceptable use case for this override at the service layer.
- **Per-platform spec compliance is per-platform, not per-post.** TikTok rejects videos longer than 60s for the organic feed; IG Reels caps at 90s; Pinterest video Pins cap at 15 min but with a 2GB ceiling; LinkedIn allows up to 10 min. The `platform-spec-compliant` check has to evaluate against each requested platform separately and emit a per-platform failure if any single platform rejects. A multi-platform post that fails spec on one platform should NOT silently publish to the others — operator decides.
- **TOS bot-detection signal pauses the connector across ALL queued posts.** When `social.tos.bot-detection.triggered` fires for a connector, the subscriber (notify + the queue scanner) must pause every queued post bound to that connector, not just the one that tripped the detector. Otherwise the next scheduled-publish tick walks straight into the same wall and escalates the platform's response.
- **Tracking link health is a moment-in-time check.** `funnel-link-healthy` passes at pre-flight, but a funnel can be torn down between pre-flight and publish (an operator deletes the page). The publish path re-checks at the moment of fan-out and fails the affected platform's leg if the link has gone dead — do not assume pre-flight is enough.
- **Idempotency is per-platform, not per-post.** A post that successfully published to 3 of 5 platforms and then crashed on the 4th must, on retry, only re-attempt the 2 remaining platforms. `publishedRefs[]` is the per-platform success log the retry path reads to figure out what's still owed.
- **Connector test (`POST /api/social/platforms/:platform/connector-test`) is a separate surface from publish.** Never use a real publish as a connectivity probe — failed test posts still leave platform-side artifacts.
- **`platforms[]` ordering is not a publish order.** The fan-out runs in parallel; do not encode "publish to TikTok first, then IG" as ordering — encode it as a scheduled-for sequence or two distinct posts.

## MJB primitives served

- **48-55** — Hook/script/caption assembly → publishable post (this capability consumes those; it doesn't generate them).
- **58-63** — Per-platform post composition + format compliance.
- **67-70** — Tracking link attach + UTM propagation + post-to-funnel join.
- **76** — Multi-platform fan-out with per-platform failure isolation.
- **79** — Block publication if brand-lane is unidentified (pre-flight check 1).
- **80** — Block private/professional audience bleed across brand lanes (the firewall — `LaneConnectorBinding` + `LaneViolation`).

## Upstream / downstream

- **Upstream reads:** `product-registry` (`brandLane`, `mediaRefs`, `creativeWinners`), `funnel-builder` (`trackingLinkId`), `connector-config` (per-platform account credentials + the lane-binding registry).
- **Upstream subscribes:** `ugc.hook.created`, `ugc.caption.created`, `gen.asset.created` (publishability gate); `product.lane.assigned` (binding-cache invalidation).
- **Downstream consumers:** `performance-loop` consumes `social.post.published` to start a performance window for that `productId` + `platformPostId`; `notify` consumes `social.lane.violation.blocked` + `social.tos.bot-detection.triggered` for operator paging; `content-dashboard` shows the queue.

## Build status checklist

- [x] `manifest.yaml`
- [x] `contracts/social.ts`
- [x] `contracts/events.ts`
- [x] `contracts/index.ts`
- [x] `README.md` (this file)
- [x] `tests/contracts.test.ts` (vitest)
- [ ] `docs/diagnostics.runbook.md` (referenced from manifest; follow-up)
- [ ] `docs/sharp-edges.md` (per the capability standard; follow-up)
- [ ] Service / router code (none yet — contracts-only scaffold)
- [ ] Per-platform adapter implementations (8 platforms)
- [ ] Lane-binding persistence + cache-invalidation on `product.lane.assigned`
- [ ] Retry-failed job (with the lane-violation / tos-challenge exclusion)
