# MJB Operational Primitives

> Extracted from C:/Code/MJB on 2026-06-29. One row per primitive; each cites its source doc.
> Source set: 17 markdown files (MJB Commerce OS thesis + 12 layer docs + 3 strategy notes + module index).
> Purpose: catalog every operational primitive the docs imply, so the CODE_MODULE_LIBRARY can later map each to a capability/workflow.

## Data ingress

| # | Primitive | Source doc | Notes |
|---|-----------|------------|-------|
| 1 | Scrape TikTok Shop trending product listings | product-intelligence.md, MJB AI Commerce Pipeline.md | Existing short-form commerce traction; ranked by buying signal |
| 2 | Scrape TikTok organic product videos + comments | product-intelligence.md | Extract hooks, comments, objections, buyer language |
| 3 | Scrape Amazon movers / trending products | product-intelligence.md, MJB Product Pipeline | Demand velocity + mine review language |
| 4 | Scrape Instagram product pages | product-intelligence.md | Creative angles + visual standards |
| 5 | Mine Reddit niche threads for pain points | product-intelligence.md | Buyer objections and demand language |
| 6 | Lookup AliExpress for supplier candidates | supplier-matching.md | Quick supplier discovery, unit cost, MOQ, shipping |
| 7 | Lookup 1688 for lower-cost source | supplier-matching.md | Lower-cost source research; Chinese marketplace |
| 8 | Lookup Taobao for supplier candidates | supplier-matching.md, MJB AI Commerce Pipeline.md | Source research; lower-cost listings |
| 9 | Lookup CSSBuy / agent purchasing source links | supplier-matching.md, MJB Commerce OS.md | China sourcing workflow + agent purchase path |
| 10 | Pull RapidAPI product/trend/search APIs | product-intelligence.md, MJB Commerce OS.md | Search, trend, marketplace data |
| 11 | Benchmark against Amazon competitive listings + reviews | supplier-matching.md | Pricing + review mining for risk + buyer language |
| 12 | Read TikTok Shop pricing + offer structure | supplier-matching.md | Market pricing reference for sale-price range |
| 13 | Manual vendor / supplier lookup (operator-entered) | supplier-matching.md, MJB AI Commerce Pipeline.md | Fallback when no API/scrape path exists |
| 14 | Pull hashtag + niche category trend signals | MJB AI Commerce Pipeline.md | Pet, home gadgets, fashion accessories, impulse-buy items |
| 15 | Ingest existing supplier photos for each candidate | media-factory.md | Source assets for cleanup + upscale pipeline |
| 16 | Capture buyer-comment language from posted content | performance-feedback-loop.md, team-operating-model.md | Objections + desires feed back into UGC + scoring |
| 17 | Collect post performance (views, watch time, saves, shares, clicks, ATC, purchases) | performance-feedback-loop.md | API or scrape where stable |
| 18 | Collect return / refund signals per product | performance-feedback-loop.md, supplier-matching.md | Feeds margin recalculation + supplier confidence |

## Processing / scoring

| # | Primitive | Source doc | Notes |
|---|-----------|------------|-------|
| 19 | Build ranked product opportunity queue from raw candidates | product-intelligence.md | Output is queue with reason-for-inclusion per row |
| 20 | Tag each candidate with first-pass decision (`skip` / `watch` / `test` / `build`) | product-intelligence.md | Intake-stage triage, before scorecard |
| 21 | Score every product 1-5 across 8 categories (demand, margin, content, visual, supplier, differentiation, fulfillment, brand fit) | product-scoring.md | Decision bands: 8-18 SKIP / 19-26 WATCH / 27-33 TEST / 34-40 BUILD |
| 22 | Compute full landed-cost margin (supplier + shipping + agent fee + payment fee + packaging + refund buffer + ad-cost assumption) | MJB AI Commerce Pipeline.md, supplier-matching.md | "Is this product worth testing?" |
| 23 | Compute supplier confidence level (Low / Medium / High) | supplier-matching.md | Sample-path + repeatability + fulfillment plan signals |
| 24 | Generate hero image prompt + lifestyle prompts + video prompts per approved product | media-factory.md, MJB Commerce OS.md | Output is media-package JSON |
| 25 | Generate 5 short-form hooks per product | ugc-concept-engine.md | Hook families: problem-reveal, discovery, comparison, before/after, routine-upgrade, gift |
| 26 | Generate 3 TikTok/Reels scripts per product | ugc-concept-engine.md | Script shape: hook -> problem proof -> product intro -> demo -> benefit -> objection -> CTA |
| 27 | Generate 3 problem-to-solution angles per product | ugc-concept-engine.md | Distinct from generic scripts |
| 28 | Generate 3 lifestyle use-case concepts per product | ugc-concept-engine.md | Buyer-context framing |
| 29 | Generate 3 objections + rebuttals per product | ugc-concept-engine.md | For ad copy + product page FAQ |
| 30 | Generate 3 caption variants per product | ugc-concept-engine.md, MJB AI Commerce Pipeline.md | Captions are platform-agnostic seed |
| 31 | Generate 1 product-demo storyboard + shot list | ugc-concept-engine.md | Shot list, not full script |
| 32 | Generate "why I bought this" + "wish I found this sooner" scripts | ugc-concept-engine.md | Two specific named UGC formats |
| 33 | Generate platform-specific caption variants from one primary post | social-distribution.md | TikTok / Reels / Stories / FB / Pinterest / LinkedIn shapes |
| 34 | Generate platform-specific asset crops/dimensions | social-distribution.md | Same hero, different aspect ratios |
| 35 | Upscale weak supplier images for use on product page | media-factory.md, MJB Commerce OS.md | Topaz-class upscaler workflow |
| 36 | Clean up product photos (background removal, color correction) | media-factory.md | Pre-publication QA pass |
| 37 | Track per-generation cost (model + input + output + product link) | automation-architecture.md, media-factory.md | Unused generations = failed production spend |
| 38 | Compute total product-test cost (research + sample + generation + page build + distribution) | media-factory.md | If media cost > test value, process is broken |
| 39 | Update product score from posted performance data | performance-feedback-loop.md | Scoring is not static; loop closes |
| 40 | Assign canonical product JSON ID + write to product registry | MJB Commerce OS.md, MJB Product Pipeline | Source of truth for every downstream workflow |
| 41 | Maintain prompt-recipe library (model + trigger words + style direction) | media-factory.md, MJB AI Commerce Pipeline.md | Reusable per brand/store lane |

## Output channels

| # | Primitive | Source doc | Notes |
|---|-----------|------------|-------|
| 42 | Publish product page from canonical product JSON | MJB AI Commerce Pipeline.md, lightweight-funnels.md | Reusable storefront template + brand skin |
| 43 | Publish lightweight funnel (landing page) | lightweight-funnels.md | One product, one hero, one offer, one CTA, tracking |
| 44 | Publish waitlist page (no inventory commitment yet) | lightweight-funnels.md | Demand validation before sourcing spend |
| 45 | Publish collection page (related product cluster) | lightweight-funnels.md | For tightly related items |
| 46 | Publish link-in-bio route (social-first test) | lightweight-funnels.md | When traffic is purely social |
| 47 | Email / SMS capture form (no checkout yet) | lightweight-funnels.md | When fulfillment is not ready |
| 48 | Post to TikTok (hook-led demo or problem/solution video, 9:16) | social-distribution.md | Default platform |
| 49 | Post to Instagram Reels (polished short demo, lifestyle visual) | social-distribution.md | Reels variant of TikTok asset |
| 50 | Post to Instagram Stories (poll / link / quick proof / BTS) | social-distribution.md | Conversion + engagement combo |
| 51 | Post to Facebook Page (direct offer + benefits + social proof) | social-distribution.md | Lower-funnel post style |
| 52 | Post to Pinterest (clean product visual + searchable title) | social-distribution.md | Niche-dependent |
| 53 | Post to LinkedIn (only when angle is business / tooling / case-study) | social-distribution.md | Conditional channel |
| 54 | Post to YouTube Shorts | MJB Commerce OS.md | Listed as optional channel |
| 55 | Send email / SMS to opt-in list | social-distribution.md | When a list exists |
| 56 | Write generated asset to Cloudflare R2 (or equivalent object store) | MJB AI Commerce Pipeline.md, MJB Commerce OS.md | Structured media library, product-linked folders |
| 57 | Attach tracking link to every published post | social-distribution.md | Required for performance loop |

## Agent roles / HITL (human-in-the-loop)

| # | Primitive | Source doc | Notes |
|---|-----------|------------|-------|
| 58 | Operator approves product promotion from TEST -> BUILD | team-operating-model.md | Human taste gate, not automated |
| 59 | Operator approves any claim-heavy script before publication | team-operating-model.md, ugc-concept-engine.md | Authenticity + legal gate |
| 60 | Operator approves any high-spend model generation batch | team-operating-model.md, automation-architecture.md | Cost governance |
| 61 | Operator approves any channel automation rollout | team-operating-model.md | Brand-lane risk |
| 62 | Operator approves any scale decision (test -> serious build) | team-operating-model.md, performance-feedback-loop.md | Requires evidence; no vanity scaling |
| 63 | AI Media Owner runs image/video generation + upscaling + brand consistency | team-operating-model.md, MJB AI Commerce Pipeline.md | Owns asset standards + naming + reusable templates |
| 64 | Automation / Data Owner runs product scraping, supplier matching, DB, APIs, cost tracking | team-operating-model.md | Owns failure detection + perf feedback loop wiring |
| 65 | Content / UGC Owner runs hook bank, scripts, captions, posting cadence, comment-language capture | team-operating-model.md | Distinct lane from AI Media Owner |
| 66 | Operator runs weekly review meeting (6 fixed questions) | team-operating-model.md | What entered queue / killed / earned test / creative winners / automation failures / build next |
| 67 | Operator does final-taste check on every UGC concept ("would a real buyer say this?") | ugc-concept-engine.md, MJB Commerce OS.md | 5-question authenticity checklist |
| 68 | Operator orders product samples (only after demand + content + margin all confirmed) | supplier-matching.md | Samples = validation, not research |
| 69 | Operator approves caption + asset + link + lane before any post schedules | social-distribution.md | 7-point pre-flight checklist |
| 70 | Operator does daily check for broken links + failed posts | performance-feedback-loop.md | Daily / weekly / monthly cadence ladder |

## Governance / decision gates

| # | Primitive | Source doc | Notes |
|---|-----------|------------|-------|
| 71 | Block product if total score < 19 (SKIP band) | product-scoring.md | Archive-only, no further work |
| 72 | Block product if any hard red flag present (unsafe, illegal, fragile, deceptive-claim-required, unstable supplier) | product-scoring.md | Overrides numeric score |
| 73 | Block product if margin spread insufficient after all real costs | supplier-matching.md, MJB AI Commerce Pipeline.md | "Do not use fake margin" |
| 74 | Block content with fake claims, fake testimonials, fake scarcity | governance-and-risk.md | Hard rule, no exceptions |
| 75 | Block content showing impossible before/after or misleading product function | governance-and-risk.md, media-factory.md | Generated-media rejection rule |
| 76 | Block automation paths that depend on platform evasion / login spoofing / spam | governance-and-risk.md, social-distribution.md | "Do not make evasion the foundation" |
| 77 | Block any paid model generation that has no product/workflow attached for cost tracking | governance-and-risk.md, automation-architecture.md | Untracked spend forbidden |
| 78 | Block scaling decisions made on view-count alone (no click/convert/margin evidence) | performance-feedback-loop.md, governance-and-risk.md | "No vanity scaling" |
| 79 | Block publication if brand-lane / store / audience / channel / link destination is unidentified | governance-and-risk.md | "If system cannot identify the lane, it cannot publish" |
| 80 | Block private/professional audience bleed across brand lanes | governance-and-risk.md | Brand-lane firewall |
| 81 | Reject media asset if it looks like generic AI filler, wrong buyer context, brand-confusing, or requires explanation | media-factory.md | Media QA rejection list |
| 82 | Reject supplier match if sizing/fit risk uncovered, exaggerated claims required, fragile parts with no margin cushion, or inconsistent specs across listings | supplier-matching.md | Source-stage rejection |
| 83 | Reject UGC concept if it invents testimonials, claims personal use that didn't happen, fakes medical/safety/financial outcomes, or promises unreliable results | ugc-concept-engine.md | Authenticity gate |
| 84 | Require funnel link verified working before scheduling any post | social-distribution.md | Pre-flight item |
| 85 | Require asset path exists before scheduling any post | social-distribution.md | Pre-flight item |
| 86 | Enforce per-decision work allowance: SKIP=archive, WATCH=research notes only, TEST=1 funnel + 3-5 concepts, BUILD=full package, SCALE=requires perf evidence | product-scoring.md | Score directly controls labor budget |
| 87 | Halt automation rollout (Phase 6) until Phases 1-5 produce repeatable manual work | implementation-roadmap.md | "Automation should lock in a proven process, not hide an unclear one" |
| 88 | Sample-order gate: do not order samples until demand + content + supplier-cost-supporting-margin + funnel-pass-likelihood all confirmed | supplier-matching.md | 4-condition gate |

## Feedback loops

| # | Primitive | Source doc | Notes |
|---|-----------|------------|-------|
| 89 | Per-product post-performance roll-up (views, watch time, saves, shares, clicks, ATC, purchases, opt-ins, returns, comment language) | performance-feedback-loop.md | Standard 10-metric record |
| 90 | Decision-state assignment per product per period: KILL / RETEST / KEEP / BUILD / SCALE | performance-feedback-loop.md | Drives next-action queue |
| 91 | Weekly review of product tests + content winners | performance-feedback-loop.md, team-operating-model.md | Weekly cadence |
| 92 | Monthly promote / kill / consolidate product lanes | performance-feedback-loop.md | Monthly cadence |
| 93 | Feed performance data back into product score | performance-feedback-loop.md | Score is dynamic |
| 94 | Feed performance data back into UGC hook bank (winning hooks promoted) | performance-feedback-loop.md, MJB AI Commerce Pipeline.md | "Winning hooks + winning creative styles" |
| 95 | Feed performance data back into media-prompt recipes (winning visual styles) | performance-feedback-loop.md, MJB AI Commerce Pipeline.md | Prompt library evolves from results |
| 96 | Feed performance data back into funnel copy (winning angles) | performance-feedback-loop.md | Funnel iteration loop |
| 97 | Feed return/refund signal back into supplier confidence | performance-feedback-loop.md, supplier-matching.md | Closes supplier-quality loop |
| 98 | Feed real conversion + ad cost back into pricing / margin assumptions | performance-feedback-loop.md | Recompute viability with actuals |
| 99 | Feed comment objections back into UGC objection/rebuttal library | performance-feedback-loop.md, ugc-concept-engine.md | Buyer-language capture |
| 100 | Track creative-winner notes per product (top hook + top asset per test window) | performance-feedback-loop.md | Stored on the product record |
| 101 | Track per-asset cost-per-result (cost / view, cost / click, cost / purchase) | automation-architecture.md, media-factory.md | Margin discipline; identifies failed production spend |
| 102 | Worker-task failure detection + retry rule per automation step | automation-architecture.md | Every worker task has: input, output, owner, failure mode, retry rule, cost, approval req |

## Cross-cutting themes

- **One canonical product JSON is the spine.** Every other primitive reads from or writes to it; the docs repeatedly insist this object be defined before any pipeline work — fields span id, brand, store, source URLs, supplier URLs, cost, shipping, sale price, margin, trend evidence, UGC angles, image/video prompts, asset paths, status, and a nested score block (demand/margin/content/visual/supplier/overall).
- **"Decision tags drive work allocation."** A product's score band (SKIP/WATCH/TEST/BUILD/SCALE) is not just a label — it controls how much labor and spend the product is allowed to consume. The scorecard literally gates the media factory, UGC engine, funnel builder, and distribution queue.
- **Content is the bottleneck, not products.** Multiple docs (MJB Commerce OS, media-factory, ugc-concept-engine) explicitly say: storefronts are cheap, products are findable, but UGC + visuals + scheduled posts are the chokepoint — so the media-factory and UGC engine need to be first-class subsystems, not afterthoughts.
- **The architecture is layered and reusable, not per-store.** One pipeline + one storefront template + brand skins + 2-3 real stores + 10-20 lightweight funnels — the entire design is built to avoid duplicating codebases or databases per brand. "Stores are skins on top of the engine."
- **Automation is earned, not assumed.** Phase 6 (automation) explicitly comes after Phases 1-5 produce repeatable manual work; "automation should lock in a proven process, not hide an unclear one." Every worker task carries owner + failure mode + retry rule + cost + approval requirement.
- **Trust + governance are first-class capabilities.** Governance is not a side document — it is the gate that blocks publication when claims, scarcity, before/after results, or brand-lane assignment fail truth tests. The system must be able to identify lane, audience, claim, and link destination or it cannot publish.
- **Cost attaches to every paid action and rolls up per product.** Generation cost, sample cost, ad spend, fees — all aggregate into total product-test cost; "if media generation cost outruns the value of the test, the process is broken." Unused generations count as failed production spend, not free.
- **The feedback loop is the moat, not the storefront.** Performance data updates scores, hook bank, prompt recipes, funnel copy, supplier confidence, and pricing. A product database with scoring history + a media library with winning angles + a testing engine that measures and improves = the compounding asset MJB is actually trying to build.
