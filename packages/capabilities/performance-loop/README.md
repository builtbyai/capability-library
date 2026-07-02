# performance-loop

L3 MJB capability. The **per-product performance roll-up** that closes the MJB feedback loop: it ingests platform-side metrics into a canonical 10-field record, assigns / mutates the product's `decisionState` (KILL / RETEST / KEEP / BUILD / SCALE), detects creative winners per test window, joins cost-ledger entries to produce cost-per-result, captures comment-objection language for hook mining, and routes domain-specific projections of all of this back to `product-scoring`, `ugc-concept-engine`, `media-generation`, `funnel-builder`, and `supplier-rescore`. It produces the data for weekly + monthly review packets; `session-digest` renders them.

Status: `planned` (contracts-only scaffold). No service code yet.

## What it is

The loop's purpose is to make every later spin of the MJB pipeline smarter than the last. It does NOT render dashboards, send notifications, or own the canonical `Product` shape — those are `content-dashboard`, `notify`, and `product-registry`. It owns the math + the bus emissions that change the system's downstream behavior based on what actually happened in the wild.

## The 10-metric record is the contract

`PerfMetricSchema` is the canonical normalized shape: `views, watchTime, saves, shares, clicks, atc, purchases, optins, returns, commentLanguageSamples`. Every platform's per-post analytics is mapped INTO this shape on ingest. Platforms surface a superset (TikTok's "video completion rate", IG's "reach", etc.), but the rollup math only operates on these 10 — cross-platform comparison stays honest because the comparison surface is constant.

**Field semantics:**

| Field | Meaning | Source |
|---|---|---|
| `views` | impressions / video-plays / page-loads as the platform defines its "view" | platform |
| `watchTime` | seconds (sum across the window) | platform |
| `saves` | bookmarks / saves / pins | platform |
| `shares` | outbound shares / reposts / reshares | platform |
| `clicks` | outbound clicks on the attached funnel link | funnel-builder side |
| `atc` | add-to-cart events on the destination funnel | funnel-builder side |
| `purchases` | completed purchases attributed to this post | funnel-builder + paypal-payments |
| `optins` | email/SMS opt-ins on the destination funnel | funnel-builder side |
| `returns` | refunds / returns attributed back to the post | paypal-payments + supplier signal |
| `commentLanguageSamples` | count of comments captured for language mining | platform comment-scraper adapter |

All fields are `z.number().min(0)` — unknown/missing platform metrics encode as `0`, not `undefined`. The math never branches on missing data.

## Decision-state is append-only history

`DecisionStateChangeSchema` is the audit row for every KILL / RETEST / KEEP / BUILD / SCALE transition. The product-registry holds the CURRENT `decisionState`; this capability owns the HISTORY of how it got there from the perf loop's perspective. Mirrors product-registry's "score history is append-only" pattern — primitive 92 needs replayability of month-over-month decision diffs, so transitions are never overwritten.

`reason` is a closed enum:

| Reason | Triggered by |
|---|---|
| `auto-rollup` | The weekly or monthly rollup job recomputed and changed state. |
| `operator-override` | A human hit `POST /api/perf/decision-state/:productId/override`. |
| `cost-cap-hit` | The cost-ledger signalled a per-product spend cap reached → forced KILL. |
| `red-flag-raised` | `product-registry` raised a blocker red flag → forced SKIP. |

Every change requires `evidence: { snapshotIds, scoreEntryIds }`. A transition with empty evidence is a bug, not a free transition.

## Cost-per-result has known measurement noise

`CostPerResultSchema` joins cost-ledger entries (ad spend, creative cost, supplier cost) with perf snapshots over the same window. **The cost-attribution window does not always align with the conversion window** — a purchase recorded today might be attributable to ad spend from 5 days ago, especially on platforms with multi-day attribution windows.

Mitigations encoded in the schema:
- `period: { startAt, endAt }` is explicit so consumers can see what window was assumed.
- `costPerResult` is persisted (not recomputed by every consumer) so the division-by-zero guard (`totalCostUsd / max(1, resultCount)`) lives in one place.
- Operators are advised to weight monthly rollups more heavily than 48h flash reads.

The schema does NOT attempt to "fix" attribution noise — that's a product question. It surfaces the assumed window so the operator's read is informed.

## Feedback routing is lossy by design

`FeedbackRoutingSchema` is the OUTBOUND emission that closes the loop. Each downstream target receives a domain-specific projection of the snapshot, not the raw 10 metrics:

| Target | What it gets |
|---|---|
| `product-scoring` | aggregate metrics + decision-state hint + cost-per-result so the next score reflects what happened |
| `ugc-concept-engine` | top-performing hook string + top objection-category mix from comment captures |
| `media-generation` | top-performing asset intake-object id + the metric it won on |
| `funnel-builder` | clicks → atc → purchase conversion ratio per funnel slug so page variants get pruned |
| `supplier-rescore` | return-rate signal + per-supplier delivery confidence delta |

Consumers receive the projection on `perf.feedback.routed` and ACK by setting `processedAt`. The lossiness is intentional — sending the raw 10-metric snapshot to every consumer would force each one to re-implement the projection logic, and it would surface ambiguity ("what do I do with `commentLanguageSamples` if I'm media-generation?").

## Review packets are data, not HTML

`ReviewPacketSchema` is the digest payload for `session-digest` to render. This capability produces the data only — it does NOT emit HTML / email. The split keeps the rendering layer (templates, brand voice, A4 vs mobile) separate from the analytics layer. `perf.weekly-rollup.ready` and `perf.monthly-rollup.ready` are the handoff events.

## Sharp edges

- **The 10-metric record is the contract — do NOT silently add an 11th.** Adding a field would break the cross-platform comparison math and every downstream consumer's projection. If a new metric matters, version `PerfMetricSchema` and force consumers to opt in.
- **Decision-state changes need both `reason` AND `evidence`.** An empty `evidence` block is a bug: a transition has to be backed by snapshots OR score entries OR both. The append rule prevents silent state-flip "fixes" from masking root causes.
- **Cost-per-result has measurement noise around the join window.** A 48h post-publish snapshot will show wildly different cost-per-result than a 30-day one. Document the assumed window in the operator UI; do not present an instantaneous number without the window beside it.
- **Feedback routing is lossy on purpose.** If a consumer needs the raw snapshot it should `GET /api/perf/snapshot/:productId` directly — do not fatten the routing payload to satisfy one consumer's curiosity.
- **`product-registry.creativeWinners` and `performance-loop.CreativeWinner` are two shapes.** The registry's is the LANDED, archival record; this one is the COMPUTED detection. The propagation path is `perf.creative-winner.detected` → subscriber writes to `product-registry` → registry emits `product.creative-winner.recorded`. Don't try to collapse them into one shape — detection has more context (computedAt, brandLane, source), archival has less.
- **`returns` are a delayed signal.** A return is recorded days-to-weeks after the purchase. The monthly rollup is the right place to weight returns; the weekly rollup will systematically underreport. The schema captures this implicitly (window-tagged), but operators must read the rollup with that lag in mind.
- **Comment captures are raw text — classification is a separate step.** `CommentObjectionCaptureSchema.objectionCategory` is optional because the classifier runs later. Don't gate the capture on classification or the buffer fills with un-captured comments while the classifier lags.
- **Snapshots are APPEND-ONLY.** Overwriting an old window's snapshot to "correct" a stale number breaks the monthly diff. Re-ingest as a new snapshot with the corrected `sourceProvider` annotation; let the rollup pick the most recent.
- **Review packet generation is `scheduler`-driven.** Don't run weekly/monthly rollups inline on an HTTP request — they're expensive joins. The capability exposes `GET /api/perf/review-packet?period=weekly` for the LATEST cached packet; the actual computation runs on the cron via `performance-loop:weekly-rollup`.

## MJB primitives served

- **16-18** — Pre-launch product-direction analytics (the 10-metric record feeds the next iteration's scoring).
- **89-91** — Per-product 10-metric record (the canonical shape).
- **92** — Monthly promote/kill/consolidate (this capability's monthly rollup writes `decisionState` transitions).
- **93-96** — Per-asset cost-per-result + creative-winner detection per test window.
- **97-99** — Feedback routing back to ugc-concept-engine + media-generation + funnel-builder.
- **100** — Track creative-winner notes per product (computed here, archived on `product-registry`).
- **101-102** — Weekly + monthly review packet generation (data payload; render lives in `session-digest`).

## Upstream / downstream

- **Subscribes:** `social.post.published` (opens a perf window for the new platform post), `cost.recorded` (feeds cost-per-result), `product.lane.assigned` (cache invalidation for lane-scoped rollups), `product.archived` (closes any open perf windows for the product).
- **Reads:** `product-registry` (for `DecisionState` enum + current product state), `cost-ledger` (for the cost rows joined into `CostPerResult`).
- **Emits:** all 9 events listed in `manifest.yaml`. The two with strongest invariants are `perf.decision-state.changed` (full audit row, append-only) and `perf.feedback.routed` (the outbound projections that change upstream behavior).
- **Drives:** `product-registry` (writes `creativeWinners` via its API), `session-digest` (sends `ReviewPacket` data for render), `notify` (consumes decision-state changes for operator paging).

## Build status checklist

- [x] `manifest.yaml`
- [x] `contracts/perf.ts`
- [x] `contracts/events.ts`
- [x] `contracts/index.ts`
- [x] `README.md` (this file)
- [x] `tests/contracts.test.ts` (vitest)
- [ ] `docs/diagnostics.runbook.md` (referenced from manifest; follow-up)
- [ ] `docs/sharp-edges.md` (per the capability standard; follow-up)
- [ ] `docs/window-and-attribution.md` (the cost-vs-conversion window discussion)
- [ ] Service / router code (none yet — contracts-only scaffold)
- [ ] Cost-per-result join implementation (cost-ledger ↔ snapshots)
- [ ] Weekly + monthly rollup jobs (cron-driven via `scheduler`)
- [ ] Comment-objection classifier (separate, lags capture by design)
