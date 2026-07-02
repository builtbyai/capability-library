# MJB -> Capability Traceability Matrix

> Generated 2026-06-29. Cross-references `mjb-primitives.md` (102 primitives) with `jobs-and-events-catalog.md` (40 capabilities) and `wiring-graph.md` (4-layer DAG).
> Rule: a primitive is "covered" only when an existing capability's declared `provides.*` surface (event / job / API / UI / CLI) actually emits or accepts the operation. Anything that requires net-new surfaces is "partial" (capability exists) or "gap" (no capability fits).

## Headline numbers

- Total primitives: **102**
- Covered: **8**
- Partial: **44**
- Gap: **50**
- New capabilities needed: **8**
  1. `product-intelligence` (L1) — scrapers/API clients for TikTok Shop, TikTok organic, Amazon, IG, Reddit, AliExpress, 1688, Taobao, CSSBuy, RapidAPI
  2. `product-registry` (L1) — canonical product JSON spine + scoring history + brand-lane assignment
  3. `product-scoring` (L1) — 8-category 1-5 scorecard, decision bands, margin/landed-cost calculator, supplier-confidence scorer, decision-state machine
  4. `ugc-concept-engine` (L2) — hook bank, scripts, storyboards, captions, objections/rebuttals, authenticity gate
  5. `funnel-builder` (L2) — product page / landing page / waitlist / collection / link-in-bio templates
  6. `social-distribution` (L2) — multi-platform post fan-out (TikTok / Reels / Stories / FB / Pinterest / LinkedIn / YouTube Shorts) + tracking-link attach + pre-flight checklist
  7. `performance-loop` (L3) — per-product metric roll-up, decision-state assignment, weekly/monthly review queues, feedback into scores/hooks/prompts/funnel/supplier/pricing
  8. `cost-ledger` (L0) — centralized spend tracker; sink for cost.recorded events from media-generation/ai-orchestration/replicate-api/deepseek-router; emits budget.exceeded to throttle downstream capabilities; satisfies primitives 37, 38, 101.
- Capabilities with no MJB linkage (truly orphan): **10**
  - `booking-scheduler`, `clipboard-bridge`, `everything-search`, `fleet-control`, `local-agent-terminal`, `mega-mount`, `storm-data`, `system-monitor`, `webrtc-stream`, `windows-control`
- Capabilities with **covert MJB roles** (initially misclassified as orphan in v1; corrected after DeepSeek V4 audit): **7**
  - `cloudflare-deploy` — infra dep of `funnel-builder` (every funnel page deploys through it)
  - `e-signature` — primitive 68 (supplier sample-order agreements)
  - `gvoice-relay` — primitive 55 (SMS opt-in delivery)
  - `og-unfurl-proxy` — primitives 57/89 (crawler-friendly funnel meta for social previews)
  - `paypal-payments` — primitives 47, 68 (sample-order checkout + future paid-product capture)
  - `transcription` — primitives 2, 16 (TikTok video audio + buyer video review extraction)
  - `vectorize` — primitives 45, 94, 99 (product clustering + hook matching + objection-to-rebuttal matching)

---

## Matrix

### Data ingress (18 primitives)

| # | Primitive | Owning capability | Specific surface | Status | Build-order |
|---|---|---|---|---|---|
| 1 | Scrape TikTok Shop trending product listings | `product-intelligence` (NEW) | (proposed) `product.candidate.discovered` event + `POST /api/sources/tiktok-shop/scan` | gap | L1 |
| 2 | Scrape TikTok organic product videos + comments | `product-intelligence` (NEW) | (proposed) `POST /api/sources/tiktok-organic/scan` + `comment.captured` event | gap | L1 |
| 3 | Scrape Amazon movers / trending products | `product-intelligence` (NEW) | (proposed) `POST /api/sources/amazon/scan` | gap | L1 |
| 4 | Scrape Instagram product pages | `product-intelligence` (NEW) | (proposed) `POST /api/sources/instagram/scan` | gap | L1 |
| 5 | Mine Reddit niche threads for pain points | `product-intelligence` (NEW) | (proposed) `POST /api/sources/reddit/scan` + `pain-point.captured` event | gap | L1 |
| 6 | Lookup AliExpress for supplier candidates | `product-intelligence` (NEW) | (proposed) `POST /api/sources/aliexpress/lookup` | gap | L1 |
| 7 | Lookup 1688 for lower-cost source | `product-intelligence` (NEW) | (proposed) `POST /api/sources/1688/lookup` | gap | L1 |
| 8 | Lookup Taobao for supplier candidates | `product-intelligence` (NEW) | (proposed) `POST /api/sources/taobao/lookup` | gap | L1 |
| 9 | Lookup CSSBuy / agent purchasing source links | `product-intelligence` (NEW) | (proposed) `POST /api/sources/cssbuy/lookup` | gap | L1 |
| 10 | Pull RapidAPI product/trend/search APIs | `connector-config` + `product-intelligence` (NEW) | `connector-config POST /api/connectors` for credentials; (proposed) `product-intelligence POST /api/sources/rapidapi/query` | partial | L0+L1 |
| 11 | Benchmark against Amazon competitive listings + reviews | `product-intelligence` (NEW) | (proposed) `POST /api/sources/amazon/competitive` + `review-text.captured` event | gap | L1 |
| 12 | Read TikTok Shop pricing + offer structure | `product-intelligence` (NEW) | (proposed) `POST /api/sources/tiktok-shop/pricing` | gap | L1 |
| 13 | Manual vendor / supplier lookup (operator-entered) | `intake-pipeline` | `POST /api/intake` (form-shaped IntakeObject for manual vendor row) | partial | L0 |
| 14 | Pull hashtag + niche category trend signals | `product-intelligence` (NEW) | (proposed) `POST /api/sources/trends/hashtags` | gap | L1 |
| 15 | Ingest existing supplier photos for each candidate | `bulk-media-import` | `bulk-import.file.uploaded` event + `bulk-media-fast-upload` CLI | covered | L1 |
| 16 | Capture buyer-comment language from posted content | `performance-loop` (NEW) | (proposed) `comment.objection.captured` event | gap | L3 |
| 17 | Collect post performance (views, watch time, saves, shares, clicks, ATC, purchases) | `performance-loop` (NEW) | (proposed) `POST /api/perf/ingest` + `perf.snapshot.recorded` event | gap | L3 |
| 18 | Collect return / refund signals per product | `performance-loop` (NEW) | (proposed) `perf.return-signal.recorded` event | gap | L3 |

### Processing / scoring (23 primitives)

| # | Primitive | Owning capability | Specific surface | Status | Build-order |
|---|---|---|---|---|---|
| 19 | Build ranked product opportunity queue from raw candidates | `product-scoring` (NEW) | (proposed) `POST /api/score/rank` + `product.queue.updated` event | gap | L1 |
| 20 | Tag each candidate with first-pass decision (skip/watch/test/build) | `product-scoring` (NEW) | (proposed) `POST /api/score/triage` + `product.decision.tagged` event | gap | L1 |
| 21 | Score every product 1-5 across 8 categories (decision bands 8-18/19-26/27-33/34-40) | `product-scoring` (NEW) | (proposed) `POST /api/score/compute` + `product.scored` event | gap | L1 |
| 22 | Compute full landed-cost margin | `product-scoring` (NEW) | (proposed) `POST /api/score/margin` + `product.margin.computed` event | gap | L1 |
| 23 | Compute supplier confidence level (Low/Med/High) | `product-scoring` (NEW) | (proposed) `POST /api/score/supplier-confidence` + `supplier.confidence.computed` event | gap | L1 |
| 24 | Generate hero image / lifestyle / video prompts per approved product | `media-generation` | `POST /api/gen/image` + `POST /api/gen/video` + `gen.asset.created` event | partial | L1 |
| 25 | Generate 5 short-form hooks per product | `ugc-concept-engine` (NEW) | (proposed) `POST /api/ugc/hooks` + `ugc.hook.created` event | gap | L2 |
| 26 | Generate 3 TikTok/Reels scripts per product | `ugc-concept-engine` (NEW) | (proposed) `POST /api/ugc/scripts` + `ugc.script.created` event | gap | L2 |
| 27 | Generate 3 problem-to-solution angles per product | `ugc-concept-engine` (NEW) | (proposed) `POST /api/ugc/angles` | gap | L2 |
| 28 | Generate 3 lifestyle use-case concepts per product | `ugc-concept-engine` (NEW) | (proposed) `POST /api/ugc/lifestyle` | gap | L2 |
| 29 | Generate 3 objections + rebuttals per product | `ugc-concept-engine` (NEW) | (proposed) `POST /api/ugc/objections` + `ugc.objection.created` event | gap | L2 |
| 30 | Generate 3 caption variants per product | `ugc-concept-engine` (NEW) | (proposed) `POST /api/ugc/captions` | gap | L2 |
| 31 | Generate 1 product-demo storyboard + shot list | `ugc-concept-engine` (NEW) | (proposed) `POST /api/ugc/storyboard` | gap | L2 |
| 32 | Generate "why I bought this" + "wish I found this sooner" scripts | `ugc-concept-engine` (NEW) | (proposed) `POST /api/ugc/scripts?format=named` | gap | L2 |
| 33 | Generate platform-specific caption variants from one primary post | `social-distribution` (NEW) | (proposed) `POST /api/distribution/captions/variants` | gap | L2 |
| 34 | Generate platform-specific asset crops/dimensions | `media-processing` | `POST /api/media/:assetId/process` + `media.variant.created` event (variant per aspect ratio) | partial | L1 |
| 35 | Upscale weak supplier images for use on product page | `media-processing` | `media-processing:upscale` job + `POST /api/media/:assetId/process` | covered | L1 |
| 36 | Clean up product photos (background removal, color correction) | `media-processing` | `POST /api/media/:assetId/process` (pluggable transcode/upscale pipeline; needs bg-removal recipe) | partial | L1 |
| 37 | Track per-generation cost (model + input + output + product link) | `media-generation` + core `CostLedger` | `media-generation CostMeter` UI + `cost.recorded` event (core) — but does not link to product id | partial | L1 |
| 38 | Compute total product-test cost (research + sample + generation + page build + distribution) | `product-scoring` (NEW) + core `CostLedger` | (proposed) `GET /api/score/products/:id/cost-roll-up` | gap | L1 |
| 39 | Update product score from posted performance data | `performance-loop` (NEW) | (proposed) `perf.score.recomputed` event -> `product-scoring` | gap | L3 |
| 40 | Assign canonical product JSON ID + write to product registry | `product-registry` (NEW) | (proposed) `POST /api/products` + `product.registered` event | gap | L1 |
| 41 | Maintain prompt-recipe library (model + trigger words + style direction) | `media-generation` | `PromptTemplateEditor` UI + `PromptHistoryTable` | partial | L1 |

### Output channels (16 primitives)

| # | Primitive | Owning capability | Specific surface | Status | Build-order |
|---|---|---|---|---|---|
| 42 | Publish product page from canonical product JSON | `funnel-builder` (NEW) | (proposed) `POST /api/funnels/product-page` + `funnel.published` event | gap | L2 |
| 43 | Publish lightweight funnel (landing page) | `funnel-builder` (NEW) | (proposed) `POST /api/funnels/landing` | gap | L2 |
| 44 | Publish waitlist page (no inventory commitment yet) | `funnel-builder` (NEW) | (proposed) `POST /api/funnels/waitlist` + `waitlist.signup` event | gap | L2 |
| 45 | Publish collection page (related product cluster) | `funnel-builder` (NEW) | (proposed) `POST /api/funnels/collection` | gap | L2 |
| 46 | Publish link-in-bio route (social-first test) | `funnel-builder` (NEW) | (proposed) `POST /api/funnels/link-in-bio` | gap | L2 |
| 47 | Email / SMS capture form (no checkout yet) | `funnel-builder` (NEW) + `email-connector` + `gvoice-relay` | (proposed) `POST /api/funnels/capture` writes contacts; `email.message.received` / `gvoice.sms.received` close loop | gap | L2 |
| 48 | Post to TikTok (hook-led demo or problem/solution video, 9:16) | `social-distribution` (NEW) | (proposed) `POST /api/distribution/post?platform=tiktok` + `post.published` event | gap | L2 |
| 49 | Post to Instagram Reels (polished short demo) | `social-distribution` (NEW) | (proposed) `POST /api/distribution/post?platform=ig-reels` | gap | L2 |
| 50 | Post to Instagram Stories (poll / link / quick proof / BTS) | `social-distribution` (NEW) | (proposed) `POST /api/distribution/post?platform=ig-stories` | gap | L2 |
| 51 | Post to Facebook Page | `social-distribution` (NEW) | (proposed) `POST /api/distribution/post?platform=facebook` | gap | L2 |
| 52 | Post to Pinterest | `social-distribution` (NEW) | (proposed) `POST /api/distribution/post?platform=pinterest` | gap | L2 |
| 53 | Post to LinkedIn (conditional) | `social-distribution` (NEW) | (proposed) `POST /api/distribution/post?platform=linkedin` | gap | L2 |
| 54 | Post to YouTube Shorts | `social-distribution` (NEW) | (proposed) `POST /api/distribution/post?platform=youtube-shorts` | gap | L2 |
| 55 | Send email / SMS to opt-in list | `notify` + `email-connector` + `gvoice-relay` | `POST /api/notify` (dispatches to email/SMS channels per routing rules) | covered | L1+L2 |
| 56 | Write generated asset to Cloudflare R2 (or equivalent object store) | `cloud-storage` + `bulk-media-import` | `cloud-storage POST /api/cloud/buckets/:bucket/upload` + `cloud.object.uploaded` event; `bulk-media-import` for batch | covered | L1+L2 |
| 57 | Attach tracking link to every published post | `social-distribution` (NEW) + `og-unfurl-proxy` | (proposed) `social-distribution` adds short-link wrapper before publish; `og-unfurl-proxy` already exists for crawler-friendly meta | gap | L2 |

### Agent roles / HITL (13 primitives)

| # | Primitive | Owning capability | Specific surface | Status | Build-order |
|---|---|---|---|---|---|
| 58 | Operator approves product promotion from TEST -> BUILD | `product-scoring` (NEW) + `content-dashboard` | (proposed) `product.promotion.requested` event; `content-dashboard WorkflowTriggerButton` handles approval click | gap | L1+L3 |
| 59 | Operator approves any claim-heavy script before publication | `ugc-concept-engine` (NEW) + `content-dashboard` | (proposed) `ugc.script.approval.required` event; queued in `dashboard.feed` for review | gap | L2+L3 |
| 60 | Operator approves any high-spend model generation batch | `media-generation` | `MEDIA_GEN_BUDGET_USD_DAILY` cap exists per manifest summary; (proposed) `gen.batch.approval.required` event | partial | L1 |
| 61 | Operator approves any channel automation rollout | `social-distribution` (NEW) + `content-dashboard` | (proposed) `distribution.rollout.approval.required` event | gap | L2+L3 |
| 62 | Operator approves any scale decision (test -> serious build) | `product-scoring` (NEW) + `performance-loop` (NEW) | (proposed) `product.scale.approval.required` event + perf-evidence bundle | gap | L1+L3 |
| 63 | AI Media Owner runs image/video generation + upscaling + brand consistency | `media-generation` + `media-processing` | `POST /api/gen/image`, `POST /api/gen/video`, `media-processing:upscale` — but no brand-consistency check declared | partial | L1 |
| 64 | Automation / Data Owner runs product scraping, supplier matching, DB, APIs, cost tracking | `product-intelligence` (NEW) + `product-registry` (NEW) + `scheduler` | `scheduler` (existing L0) dispatches scrape/lookup jobs; product-intelligence + product-registry owned by this role | gap | L1 |
| 65 | Content / UGC Owner runs hook bank, scripts, captions, posting cadence, comment-language capture | `ugc-concept-engine` (NEW) + `social-distribution` (NEW) + `scheduler` | Roles defined by capability ownership; `scheduler` cron drives cadence | gap | L2 |
| 66 | Operator runs weekly review meeting (6 fixed questions) | `performance-loop` (NEW) + `session-digest` | (proposed) `perf.weekly-review.assembled` event; `session-digest POST /api/digest/generate` renders the 6-question packet | partial | L2+L3 |
| 67 | Operator does final-taste check on every UGC concept (5-question authenticity checklist) | `ugc-concept-engine` (NEW) + `content-dashboard` | (proposed) `ugc.authenticity-check.required` event queued in dashboard feed | gap | L2+L3 |
| 68 | Operator orders product samples (only after 4-condition gate) | `product-scoring` (NEW) + `paypal-payments` | (proposed) `product.sample.order.requested` event after gate passes; `paypal-payments POST /api/paypal/orders` handles checkout | partial | L1+L2 |
| 69 | Operator approves caption + asset + link + lane before any post schedules (7-point pre-flight) | `social-distribution` (NEW) + `content-dashboard` | (proposed) `post.preflight.required` event w/ 7-point payload | gap | L2+L3 |
| 70 | Operator does daily check for broken links + failed posts | `social-distribution` (NEW) + `system-monitor` | (proposed) `link.health.check` job; `system-monitor` widget surfaces broken-link alerts | partial | L2+L3 |

### Governance / decision gates (18 primitives)

| # | Primitive | Owning capability | Specific surface | Status | Build-order |
|---|---|---|---|---|---|
| 71 | Block product if total score < 19 (SKIP band) | `product-scoring` (NEW) | (proposed) `product.scored` event w/ band=SKIP triggers gate; downstream caps refuse | gap | L1 |
| 72 | Block product if any hard red flag present | `product-scoring` (NEW) | (proposed) `product.red-flag.raised` event | gap | L1 |
| 73 | Block product if margin spread insufficient after all real costs | `product-scoring` (NEW) | (proposed) `product.margin.rejected` event | gap | L1 |
| 74 | Block content with fake claims, fake testimonials, fake scarcity | `ugc-concept-engine` (NEW) | (proposed) `ugc.authenticity.violation` event | gap | L2 |
| 75 | Block content showing impossible before/after or misleading product function | `media-generation` + `ugc-concept-engine` (NEW) | (proposed) `media.before-after.rejected` event (declared rejection list referenced in manifest summary, no enforcement surface yet) | partial | L1+L2 |
| 76 | Block automation paths that depend on platform evasion / login spoofing / spam | `social-distribution` (NEW) + `connector-config` | `connector-config` records what auth path is in use; (proposed) `distribution.policy.violation` event | gap | L0+L2 |
| 77 | Block any paid model generation that has no product/workflow attached for cost tracking | `media-generation` | `media-generation` declares `MEDIA_GEN_BUDGET_USD_DAILY`; (proposed) refuse `POST /api/gen/image` w/o `productId` | partial | L1 |
| 78 | Block scaling decisions made on view-count alone (no click/convert/margin evidence) | `performance-loop` (NEW) + `product-scoring` (NEW) | (proposed) `perf.evidence.insufficient` event before SCALE approval | gap | L1+L3 |
| 79 | Block publication if brand-lane / store / audience / channel / link destination is unidentified | `product-registry` (NEW) + `social-distribution` (NEW) | (proposed) lane-required check on `social-distribution` pre-flight | gap | L1+L2 |
| 80 | Block private/professional audience bleed across brand lanes | `product-registry` (NEW) + `connector-config` | (proposed) connector-account-to-brand-lane binding enforced by `social-distribution` | gap | L0+L1+L2 |
| 81 | Reject media asset if it looks like generic AI filler, wrong buyer context, brand-confusing, or requires explanation | `media-generation` + `ugc-concept-engine` (NEW) | (proposed) `gen.asset.rejected` event w/ reason; QA queue in dashboard | partial | L1+L2 |
| 82 | Reject supplier match if sizing/fit risk, exaggerated claims, fragile-no-cushion, or inconsistent specs | `product-scoring` (NEW) | (proposed) `supplier.rejected` event w/ reason taxonomy | gap | L1 |
| 83 | Reject UGC concept if invents testimonials / fakes personal use / fakes medical-safety-financial outcomes / promises unreliable results | `ugc-concept-engine` (NEW) | (proposed) `ugc.authenticity.violation` event (overlap w/ 74; specific concept-level enforcement) | gap | L2 |
| 84 | Require funnel link verified working before scheduling any post | `funnel-builder` (NEW) + `social-distribution` (NEW) | (proposed) `funnel.link.verified` event must precede `post.scheduled` | gap | L2 |
| 85 | Require asset path exists before scheduling any post | `intake-pipeline` + `social-distribution` (NEW) | `intake.object.stored` event proves asset path; (proposed) pre-flight check in `social-distribution` consumes it | partial | L0+L2 |
| 86 | Enforce per-decision work allowance: SKIP=archive / WATCH=notes / TEST=1 funnel + 3-5 concepts / BUILD=full / SCALE=requires perf evidence | `product-scoring` (NEW) | (proposed) decision-band -> work-allowance policy enforced at handler dispatch (consumed by media-generation, ugc-concept-engine, funnel-builder) | gap | L1 |
| 87 | Halt automation rollout (Phase 6) until Phases 1-5 produce repeatable manual work | `scheduler` | `scheduler POST /api/scheduler/jobs/:id/disable` toggles automation; no policy gate declared | partial | L0 |
| 88 | Sample-order gate: do not order samples until demand + content + supplier-cost + funnel-pass all confirmed | `product-scoring` (NEW) + `paypal-payments` | (proposed) 4-condition check before `paypal-payments` charges sample | gap | L1+L2 |

### Feedback loops (14 primitives)

| # | Primitive | Owning capability | Specific surface | Status | Build-order |
|---|---|---|---|---|---|
| 89 | Per-product post-performance roll-up (10-metric record) | `performance-loop` (NEW) | (proposed) `perf.snapshot.recorded` event; `GET /api/perf/products/:id` | gap | L3 |
| 90 | Decision-state assignment per product per period: KILL / RETEST / KEEP / BUILD / SCALE | `performance-loop` (NEW) | (proposed) `perf.decision.assigned` event | gap | L3 |
| 91 | Weekly review of product tests + content winners | `performance-loop` (NEW) + `session-digest` + `scheduler` | `scheduler.tick` (cron) -> `session-digest POST /api/digest/generate` w/ weekly perf template | partial | L3 |
| 92 | Monthly promote / kill / consolidate product lanes | `performance-loop` (NEW) + `product-registry` (NEW) + `scheduler` | (proposed) monthly cron emits `perf.month.roll-up` | gap | L1+L3 |
| 93 | Feed performance data back into product score | `performance-loop` (NEW) -> `product-scoring` (NEW) | (proposed) `perf.score.recomputed` event subscribed by `product-scoring` | gap | L1+L3 |
| 94 | Feed performance data back into UGC hook bank (winning hooks promoted) | `performance-loop` (NEW) -> `ugc-concept-engine` (NEW) | (proposed) `perf.hook.winner` event subscribed by `ugc-concept-engine` | gap | L2+L3 |
| 95 | Feed performance data back into media-prompt recipes (winning visual styles) | `performance-loop` (NEW) -> `media-generation` | (proposed) `perf.prompt.winner` event subscribed by `media-generation PromptTemplateEditor` | partial | L1+L3 |
| 96 | Feed performance data back into funnel copy (winning angles) | `performance-loop` (NEW) -> `funnel-builder` (NEW) | (proposed) `perf.funnel.winner` event subscribed by `funnel-builder` | gap | L2+L3 |
| 97 | Feed return/refund signal back into supplier confidence | `performance-loop` (NEW) -> `product-scoring` (NEW) | (proposed) `perf.return-signal.recorded` subscribed by `product-scoring:supplier-confidence` | gap | L1+L3 |
| 98 | Feed real conversion + ad cost back into pricing / margin assumptions | `performance-loop` (NEW) -> `product-scoring` (NEW) | (proposed) `perf.margin.recompute` event subscribed by `product-scoring:margin` | gap | L1+L3 |
| 99 | Feed comment objections back into UGC objection/rebuttal library | `performance-loop` (NEW) -> `ugc-concept-engine` (NEW) | (proposed) `comment.objection.captured` subscribed by `ugc-concept-engine:objections` | gap | L2+L3 |
| 100 | Track creative-winner notes per product (top hook + top asset per test window) | `product-registry` (NEW) + `performance-loop` (NEW) | (proposed) `product.creative-winner.recorded` event written to product JSON | gap | L1+L3 |
| 101 | Track per-asset cost-per-result (cost/view, cost/click, cost/purchase) | `performance-loop` (NEW) + core `CostLedger` | (proposed) join of `cost.recorded` (core) + `perf.snapshot.recorded`; no current surface | gap | L3 |
| 102 | Worker-task failure detection + retry rule per automation step | `scheduler` + `notify` | `scheduler.job.failed` event + `scheduler:RetryPolicyEditor` UI + `notify POST /api/notify` for alerts | covered | L0+L1 |

---

## Gap analysis

For every `gap` row above, this section consolidates the new-capability proposals (rather than adding the same proposal once per row).

### New capabilities to add to `registry.yaml`

#### `product-intelligence` (L1)
- **kind:** capability
- **riskLevel:** `network-bridge` (scraping multiple external sites + UA risk)
- **summary:** Source-discovery adapters for TikTok Shop / TikTok organic / Amazon / Instagram / Reddit / AliExpress / 1688 / Taobao / CSSBuy / RapidAPI / hashtag trend feeds. Emits canonical `product.candidate.discovered`, `comment.captured`, `pain-point.captured`, `review-text.captured` events. Depends on `connector-config` (credentials), `intake-pipeline` (everything lands as IntakeObject), `scheduler` (recurring scrape windows).
- **covers primitives:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 64
- Scaffold landed: see `packages/capabilities/product-intelligence/` (contracts-only; concrete adapters are a follow-up keyed off `kb/rapidapi-research.md`).

#### `product-registry` (L1)
- **kind:** capability
- **riskLevel:** `sensitive-data`
- **summary:** The canonical product JSON spine. CRUD over the product record (id, brand, store/brand-lane, source URLs, supplier URLs, cost, shipping, sale price, margin, trend evidence, UGC angles, image/video prompts, asset paths, status, nested score block, creative-winners log, scoring history). Every other MJB capability reads/writes this. Depends on `intake-pipeline`.
- **covers primitives:** 40, 79 (lane assignment), 80 (lane firewall), 92, 100
- Scaffold landed: see `packages/capabilities/product-registry/` (contracts-only; Product extends ProductCandidate with lifecycle/decision-state/score-history/lane/red-flags/creative-winners/consolidation/supplier-links).

#### `product-scoring` (L1)
- **kind:** capability
- **riskLevel:** `normal`
- **summary:** Triage tagger, 8-category 1-5 scorecard, decision bands, landed-cost margin calculator, supplier-confidence scorer, decision-state machine (SKIP / WATCH / TEST / BUILD / SCALE), red-flag gate, sample-order gate, work-allowance policy enforcement. Subscribes `product.candidate.discovered` (from product-intelligence), emits `product.scored`, `product.decision.tagged`, `supplier.confidence.computed`, `product.margin.computed`, `product.red-flag.raised`, `supplier.rejected`. Depends on `product-registry`.
- **covers primitives:** 19, 20, 21, 22, 23, 38, 39, 58, 62, 68, 71, 72, 73, 78, 82, 86, 88, 93, 97, 98

#### `ugc-concept-engine` (L2)
- **kind:** capability
- **riskLevel:** `external-ai-processing` (LLM-generated scripts/hooks)
- **summary:** Hook bank (problem-reveal / discovery / comparison / before-after / routine-upgrade / gift families), 3-script generator, problem-to-solution angles, lifestyle concepts, objections + rebuttals, captions, storyboard + shot list, named-format scripts ("why I bought this", "wish I found this sooner"). Authenticity gate enforces the 5-question checklist + rejection rules (no fake testimonials, no fake personal use, no medical/safety/financial claims). Depends on `deepseek-router` (LLM), `product-registry` (concept attaches to product), `intake-pipeline` (assets ingested as IntakeObjects).
- **covers primitives:** 25, 26, 27, 28, 29, 30, 31, 32, 59, 65, 67, 74, 83, 94, 99

#### `funnel-builder` (L2)
- **kind:** capability
- **riskLevel:** `normal`
- **summary:** Reusable storefront / landing-page / waitlist / collection / link-in-bio templates rendered from product JSON + brand skin. Capture form for email/SMS opt-ins. Tracking-link generator. Funnel-link health probe (used by pre-flight). Depends on `product-registry`, `cloudflare-deploy` (page publish target).
- **covers primitives:** 42, 43, 44, 45, 46, 47, 84, 96

#### `social-distribution` (L2)
- **kind:** capability
- **riskLevel:** `network-bridge`
- **summary:** Multi-platform post fan-out (TikTok / Instagram Reels / Stories / Facebook / Pinterest / LinkedIn / YouTube Shorts). Generates platform-specific caption variants and asset-crop variants from one primary asset. Attaches tracking link before publish. 7-point pre-flight checklist (caption + asset path + tracking link + brand lane + audience + channel + link destination all present). Enforces no-evasion policy. Depends on `connector-config` (per-platform OAuth), `media-processing` (crop variants), `notify` (publish failures), `scheduler` (post cadence).
- **covers primitives:** 33, 48, 49, 50, 51, 52, 53, 54, 57, 61, 65, 69, 70, 76, 79, 84, 85

#### `performance-loop` (L3)
- **kind:** capability
- **riskLevel:** `normal`
- **summary:** Per-product post-performance roll-up (10-metric record: views, watch time, saves, shares, clicks, ATC, purchases, opt-ins, returns, comment language). Decision-state assignment (KILL / RETEST / KEEP / BUILD / SCALE). Weekly/monthly review packet assembly. Feedback emitters that route winning data back into `product-scoring`, `ugc-concept-engine`, `media-generation`, `funnel-builder`. Per-asset cost-per-result computation by joining core `cost.recorded` with perf snapshots. Depends on `product-registry`, `scheduler`, `notify`, `session-digest`.
- **covers primitives:** 16, 17, 18, 39, 66, 70, 78, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101

#### `cost-ledger` (L0)
- **kind:** capability
- **riskLevel:** `sensitive-data` (financial data)
- **summary:** Centralized spend ledger. Any capability that incurs cost (model tokens, image/video gen seconds, third-party API calls, infra) emits `cost.recorded` here; consumers subscribe to `cost.budget.exceeded` for alerting and throttling. Emits `cost.report.generated` from daily/per-product rollup jobs (consumed by `session-digest`). Promotes the existing core `CostLedger` class (`packages/core/src/cost-ledger.ts`) to a first-class capability so downstream caps (`product-scoring`, `performance-loop`, `media-generation`) can declare a hard dep on it via the manifest mechanism rather than a core-internal import. Depends on nothing (L0).
- **covers primitives:** 37, 38, 101 (the three primitives the wiring-graph and DeepSeek V4 audit both flagged as having no proper capability home)

### Surfaces existing capabilities should grow (no new capability)

These are 🟡 partial rows where the right home is an existing capability but the manifest does not yet declare the exact surface:

- **`media-generation`** — add `productId` requirement on `POST /api/gen/image` / `POST /api/gen/video` (primitive 77); add `gen.batch.approval.required` event for over-budget batches (60); add `media.before-after.rejected` event for primitive 75; surface `PromptTemplateEditor` updates from `perf.prompt.winner` event (95).
- **`media-processing`** — add background-removal recipe (36); add aspect-ratio crop variants surface (34).
- **`intake-pipeline`** — accept "form-shaped" IntakeObjects for manual vendor entries (13).
- **`content-dashboard`** — add an approval-queue surface that ingests `*.approval.required` events from product-scoring/ugc/distribution/media-generation (58, 59, 61, 67, 69).
- **`session-digest`** — add a weekly-review template that accepts a perf packet (66, 91).
- **`scheduler`** — add a manifest-level kill-switch gate so automation can be paused per Phase-6-gating rule (87).
- **`og-unfurl-proxy`** — already covers crawler-friendly meta when funnel pages live behind protected hosts; explicitly bind to `funnel-builder` outputs (57).

---

## Capability utilization

| Capability | # MJB primitives it satisfies (covered or partial) | Coverage role |
|---|---|---|
| **NEW `product-scoring`** | 20 | core spine — scorecard, gates, decision states |
| **NEW `performance-loop`** | 20 | core spine — feedback moat MJB explicitly calls "the moat, not the storefront" |
| **NEW `social-distribution`** | 17 | core spine — every output channel + governance pre-flight funnels here |
| **NEW `ugc-concept-engine`** | 15 | core spine — content is the bottleneck per MJB thesis |
| **NEW `product-intelligence`** | 14 | core spine — all data ingress |
| **NEW `funnel-builder`** | 8 | core spine — owns every publish surface MJB lists |
| **NEW `product-registry`** | 5 | core spine — canonical product JSON; written/read by every other MJB cap |
| `media-generation` | 8 | strong support — owns generation + cost cap; primary L1 dep of UGC engine |
| `media-processing` | 4 | strong support — upscale + crops for every published asset |
| `notify` | 3 | spine — failure path for every gate + scheduled cron alerts |
| `scheduler` | 4 | spine — cron tick is the heartbeat of the loop |
| `intake-pipeline` | 4 | spine — every IntakeObject in the system (assets, vendor rows, comments) |
| `connector-config` | 3 | spine — credentials for every external platform |
| `bulk-media-import` | 1 | single-purpose — supplier photo ingest in bulk |
| `cloud-storage` | 1 | single-purpose — R2 asset library |
| `content-dashboard` | 5 (approval queue role) | strong support — operator review surface |
| `session-digest` | 2 | strong support — weekly review packet renderer |
| `og-unfurl-proxy` | 1 (tracking-link / OG meta) | single-purpose — crawler-friendly meta for funnel pages |
| `paypal-payments` | 2 (sample order, capture form upsell) | single-purpose — sample-order checkout + future paid products |
| `email-connector` | 1 | single-purpose — opt-in list + comment-thread email path |
| `gvoice-relay` | 1 | single-purpose — SMS opt-in delivery |
| `whatsapp-bridge` | 0 directly (but `whatsapp.message.received` could feed comment-capture) | speculative MJB linkage |
| `knowledge-index` | 0 directly (but objection library + comment archive are RAG-shaped) | speculative MJB linkage |
| `deepseek-router` | 0 directly (but every LLM call MJB makes routes through it) | core infra dep of `ugc-concept-engine`, `ai-orchestration` |
| `ai-orchestration` | 0 directly (but multi-model UGC iteration is the obvious user) | speculative MJB linkage |
| `replicate-api` | 0 directly (but every image/video gen routes through it via media-generation) | core infra dep |
| `cloudflare-deploy` | 0 directly (but every funnel page MJB ships deploys through it) | core infra dep of `funnel-builder` |
| `widget-framework` | 0 | infra — dashboard chrome only |
| **Truly orphan caps with no MJB linkage** (10) | `booking-scheduler`, `clipboard-bridge`, `everything-search`, `fleet-control`, `gpu-router`, `local-agent-terminal`, `mega-mount`, `storm-data`, `system-monitor`, `webrtc-stream`, `windows-control` | dashboard/ops fleet caps — keep, but they do not serve MJB MVP |
| **Covert-role caps** (7) | `cloudflare-deploy`, `e-signature`, `gvoice-relay`, `og-unfurl-proxy`, `paypal-payments`, `transcription`, `vectorize` | MJB-relevant after all (see headline). Build effort prioritization: post-MVP, but before fully orphan caps. |

---

## Build-order recommendation (MJB thin-slice MVP)

**Goal:** smallest capability set that demonstrates each MJB bucket (data ingress -> scoring -> media -> UGC -> funnel -> distribution -> performance loop -> governance) end-to-end for one product, one brand lane, one platform.

### L0 (foundation — 5 caps)
1. `connector-config` — credentials for TikTok/Amazon scraping APIs + Cloudflare + R2
2. `intake-pipeline` — universal front door (every product candidate, supplier photo, comment, perf snapshot lands here)
3. `scheduler` — cron tick for scrapes + weekly perf roll-up
4. `deepseek-router` — LLM call routing (drives UGC engine; ~50x cheaper than direct Claude)
5. **NEW** `cost-ledger` — spend sink for every L1+ capability (media-gen, deepseek-router, scrape APIs); without it, primitives 37/38/101 have no home and product-scoring cannot compute total product-test cost

### L1 (4 NEW + 3 existing = 7 caps)
5. `bulk-media-import` (existing, production-ready) — supplier photos in bulk
6. `media-generation` (existing, planned) — hero / lifestyle / video prompts -> assets
7. `media-processing` (existing, planned) — upscale + aspect-ratio crops
8. **NEW** `product-intelligence` — at minimum: TikTok Shop + Amazon scrape + RapidAPI bridge (skip 1688/Taobao/CSSBuy/Reddit/IG for MVP; they're additive)
9. **NEW** `product-registry` — canonical product JSON
10. **NEW** `product-scoring` — 8-category scorecard + decision bands + landed-cost margin + work-allowance policy
11. `notify` (existing, planned) — failure path for everything

### L2 (3 NEW + 1 existing = 4 caps)
12. `cloud-storage` (existing, planned) — R2 asset library
13. **NEW** `ugc-concept-engine` — hooks + 3 scripts + objections + authenticity gate (skip storyboard/named-formats for MVP)
14. **NEW** `funnel-builder` — product page + landing page template (skip waitlist/collection/link-in-bio for MVP)
15. **NEW** `social-distribution` — TikTok-only for MVP (skip 6 other platforms; prove the spine, then fan out)

### L3 (1 NEW + 1 existing = 2 caps)
16. `content-dashboard` (existing, planned) — operator approval queue + feed
17. **NEW** `performance-loop` — TikTok perf ingest + decision-state assignment + weekly digest

**Total MVP: 18 capabilities** (5 L0 + 7 L1 + 4 L2 + 2 L3). 8 of these are NEW; 10 are existing planned caps that need to be built out from scaffold to real code.

Once 17 ships, layer in: `session-digest` (weekly review), `paypal-payments` (sample orders), `email-connector` + `gvoice-relay` (opt-in capture/delivery), `og-unfurl-proxy` (crawler-friendly funnel meta), `whatsapp-bridge` (operator alerts).

---

## Risk notes

### riskLevel mismatches between MJB primitives and matched capabilities

- **`media-generation` riskLevel = `external-ai-processing`** — but MJB primitives 75 (impossible before/after) + 77 (untracked spend) + 81 (rejection list) imply this capability also enforces governance gates. Either it stays `external-ai-processing` and a separate governance layer enforces gates, or its risk profile is upgraded to acknowledge the gating responsibility.
- **NEW `social-distribution` proposed risk = `network-bridge`** — but primitive 76 ("block automation paths that depend on platform evasion / login spoofing / spam") imports a `privileged` concern. Consider splitting: a `network-bridge` posting capability + a `privileged` `policy-enforcement` capability.
- **NEW `product-intelligence` proposed risk = `network-bridge`** — TikTok / Amazon scraping triggers their TOS bot-detection. This capability is the most likely source of cease-and-desist / account-ban events. May need a stricter `privileged` classification + per-source kill-switch.
- **`bulk-media-import` riskLevel = `filesystem-write`** — fine for supplier photo ingest, but if it ever holds private supplier contracts (vendor lookup memo), it slides into `sensitive-data`.

### Capability saturation — single funnels with too much load

- **`notify`** receives failure events from EVERY new MJB capability (product-intelligence scrape failures, product-scoring red flags, ugc authenticity violations, social-distribution publish failures, performance-loop ingest gaps, funnel-builder link breaks). It is already a sink for ~10 existing capabilities. Recommend (a) tag routing by capability so dashboards can filter, (b) per-capability rate limits to prevent alert-storm during a single scrape outage.
- **`content-dashboard`** becomes the universal operator-approval surface (primitives 58, 59, 61, 67, 69, plus all the existing intake/document/clip feed entries). Needs an explicit `approval-queue` surface separate from the read-only feed, or it will saturate.
- **`scheduler`** dispatches cron for every scraper (12 sources possible at primitive level), every weekly/monthly perf roll-up, every cadence-driven post, every link health probe. The current `POST /api/scheduler/jobs` is fine, but `scheduler.tick` becomes a hot bus event; consider per-handler tick fanout instead of one global tick.
- **`intake-pipeline`** is the universal storage for: scraped product candidates, supplier photos, generated assets, vendor manual rows, perf snapshots, comment captures. The MVP routing table will be large. Recommend an early `intake.object.routed` taxonomy so MJB-specific consumers (product-registry, performance-loop) can subscribe without wildcards.

### Governance gates without a matched enforcement capability

- **Primitive 80 (audience bleed across brand lanes)** — no capability owns the brand-lane firewall today. Proposed home is `product-registry` (lane assignment) + `social-distribution` (lane-binding check at publish time), but neither has manifest language for it yet. Without an explicit enforcer, the gate exists only as policy text.
- **Primitive 87 (halt automation until Phases 1-5 produce repeatable manual work)** — there is no capability that tracks "phase maturity" or "manual repeatability score". This is a workflow-level concern, not capability-level. May need a `workflow` entry (e.g. `mjb-phase-tracker`) rather than a new capability.
- **Primitive 86 (work-allowance enforcement)** — proposed home is `product-scoring`, but enforcement happens at OTHER capabilities (media-generation refuses spend, ugc-concept-engine caps concept count, funnel-builder caps page count). Cross-cap policy enforcement is a new pattern not present in the current registry; needs either (a) a shared `policy-port` in `@multimarcdown/core`, or (b) every downstream capability subscribing to `product.decision.tagged` and self-throttling. (b) is more decentralized but harder to audit; (a) is more brittle but easier to reason about.
- **Primitive 38 (total product-test cost roll-up)** — `cost.recorded` lives in `@multimarcdown/core` as a CostLedger, but per the wiring-graph "core is not a capability, so dashboards can't depend on it via the manifest mechanism." Either CostLedger gets promoted to a `cost-ledger` capability, or product-scoring takes a hard core-internal dep that bypasses the manifest contract.

### Cross-cutting

- The **canonical product JSON** is referenced by ~40 of the 102 primitives. Build `product-registry` BEFORE anything else in L1, or every other new capability ends up inventing its own product shape. This is the "decide contracts first" rule the library is built on.
- **Brand-lane assignment** is touched by primitives 79, 80, and implied by 58, 61, 69 (lane appears in pre-flight). Treat it as a first-class field in `product-registry`, not an afterthought on `social-distribution`.
- **Only 10 truly orphan capabilities** (booking, fleet-control, sysmon, etc.) — these serve the dashboard layer MJB sits on top of. Keep them, but mark them OFF the MJB MVP critical path so build effort goes to the 7 NEW MJB caps first.
- **7 covert-role caps** (cloudflare-deploy, e-signature, gvoice-relay, og-unfurl-proxy, paypal-payments, transcription, vectorize) are real MJB dependencies that the v1 synthesis misclassified as orphan. Most importantly, **paypal-payments is the only payment capability in the library** — deprioritizing it because of a label error would leave the entire MJB monetization spine unbuilt. The DeepSeek V4 audit caught this (see `mjb-audit-deepseek-v4.md`).
