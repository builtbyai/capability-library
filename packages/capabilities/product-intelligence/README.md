# product-intelligence

L1 MJB capability. **External product / supplier / social data ingress** for the MJB commerce pipeline. Owns the 10 source families that feed every downstream commerce primitive, and emits a canonical `ProductCandidate` shape (~40 of the 102 MJB primitives consume it).

Status: `planned` (contracts-only scaffold). Concrete adapter implementations are a follow-up keyed off `kb/rapidapi-research.md`.

## Why this is a separate capability from `intake-pipeline`

`intake-pipeline` handles **bytes** — universal file/blob storage with deduplication and IntakeObject lifecycle. `product-intelligence` handles **structured commerce data** — typed `ProductCandidate` rows with normalized fields, per-source TOS isolation, and rate-limit / bot-detection awareness baked into the adapter port shape. The two compose: media refs on a ProductCandidate are uploaded *through* intake-pipeline; the structured row itself lives in this capability's domain.

## The 10 source families

| Source family | MJB primitive(s) | Adapter port file | Notes |
|---|---|---|---|
| `tiktok-shop` | 1, 12 | `contracts/adapters/tiktok-shop.ts` | Trending listings + pricing/offer structure |
| `tiktok-organic` | 2 | `contracts/adapters/tiktok-organic.ts` | Product videos + comment text |
| `amazon` | 3, 11 | `contracts/adapters/amazon.ts` | Movers + competitive listings + reviews |
| `instagram` | 4 | `contracts/adapters/instagram.ts` | Branded-content / shop-tag pages |
| `reddit` | 5 | `contracts/adapters/reddit.ts` | Niche-thread pain-point mining |
| `aliexpress` | 6 | `contracts/adapters/aliexpress.ts` | Supplier candidate lookup |
| `1688` | 7 | `contracts/adapters/_1688.ts` | Lower-cost CN wholesale source |
| `taobao` | 8 | `contracts/adapters/taobao.ts` | C2C supplier candidate lookup |
| `cssbuy` | 9 | `contracts/adapters/cssbuy.ts` | Agent-purchasing URL translation |
| `trends` | 14 | `contracts/adapters/trends.ts` | Hashtag + niche-category signals |

RapidAPI (MJB primitive 10) is a **meta-bridge** — most of the above can be implemented by RapidAPI providers rather than direct scraping. The adapter `kind: 'rapidapi'` flag tells the runtime which TOS risk class the implementation belongs to.

## The canonical `ProductCandidate` shape

Defined in `contracts/product-candidate.ts`. One paragraph summary: a `ProductCandidate` is the source-agnostic product object — id, source family, source-side id, name, price (USD-normalized + original currency), media refs (uploaded via intake-pipeline), optional supplier hint, optional social signals, optional review summary, free `competitiveContext` for source-specific extras, and a `rawSnapshot` of the verbatim provider response so re-extraction never needs a re-fetch. Two sibling shapes — `PainPointSchema` (for Reddit / TikTok-organic / Amazon-review buyer language) and `SupplierCandidateSchema` (for dedicated supplier rows from AliExpress / 1688 / Taobao / CSSBuy) — round out the contract surface.

## Adapter pattern

Every concrete adapter implements **one** of the 10 ports. A single port can have **multiple implementations** simultaneously — for example, `AmazonAdapterPort` may be served by:

- `amazon:rapidapi:real-time-amazon-data` (`kind: 'rapidapi'`)
- `amazon:rapidapi:axesso` (`kind: 'rapidapi'`)
- `amazon:sp-api` (`kind: 'official-api'`)
- `amazon:playwright-fallback` (`kind: 'scrape-browser'`)

The runtime chooses by `kind` priority (`official-api` > `rapidapi` > `scrape-http` > `scrape-browser`) crossed with the latest `healthCheck()` result. When the primary adapter fails (rate-limit, bot-detection, auth-failed), the runtime falls forward to the next implementation in the same port, NOT to a different source family.

Every adapter method returns a discriminated union — `{ ok: true; data: T } | { ok: false; reason: 'rate-limit' | 'bot-detected' | 'tos-block' | 'auth-failed' | 'transient' | 'no-results'; retryAfterMs? }` — so policy (retry, back-off, auto-pause, surface to operator) is a caller decision rather than buried in adapter internals.

## Sharp edges (TOS risk per source)

- **Amazon, TikTok organic, 1688** — flip into bot-detection FASTEST. Use paid RapidAPI providers as primary. Direct scraping from non-CN IPs against 1688 is essentially non-viable.
- **CSSBuy** — intermittent uptime (smaller infra), not adversarial. Transient failures are routine; the runtime should fall back to surfacing the upstream Taobao/1688 URL with a "no agent quote available" flag rather than blocking the workflow.
- **Reddit** — does not flip into bot-detection but hard-throttles. OAuth is required for production-grade rate limits (post-2023 policy change).
- **Auto-pause discipline** — when an adapter returns `bot-detected` or `tos-block`, the runtime emits `tos.bot-detection.triggered` AND pauses that source family (not just the failing adapter) for the configured cool-down (default: 30 min for first occurrence, exponential backoff thereafter). This prevents a single TOS violation from cascading across multiple adapters of the same source.
- **Per-source isolation** — a `tos-block` on Amazon must NOT pause TikTok-organic. Source families are isolated by design; cross-source contagion (a shared IP getting blocked everywhere) is a configuration concern at the proxy / connector-config layer, not at this capability's port boundary.

## RapidAPI shortlist research

The user surfaced these RapidAPI providers via browsing behavior on 2026-06-29 (visit counts as the shortlist signal). See `kb/rapidapi-research.md` for the full table and methodology caveat. These are **research candidates, not contracts** — each concrete adapter still needs the provider's docs fetched, auth shape pinned, and rate-limit characteristics measured before it can be promoted to an `kind: 'rapidapi'` implementation.

Top picks for the MVP build order:

- Amazon: `Real-Time Amazon Data`, `Amazon Online Data API` (tied — 4 visits each)
- Taobao + 1688: `Taobao 1688 API` (4 visits — covers both source families)
- Taobao: `Taobao DataHub`, `TaoBao® API: Search Items & Shops` (3 visits each)
- Amazon comparison candidates: `Amazon Product Info`, `Axesso - Amazon Data Service` (3 visits each)

## How downstream caps consume

- `product-registry` — subscribes to `product.candidate.discovered`, writes the canonical product JSON spine (and merges later `product.candidate.enriched` patches).
- `product-scoring` — consumes `product.candidate.enriched` once supplier + review enrichment have landed; runs the 8-category scorecard.
- `ugc-concept-engine` — consumes `pain-point.captured` + `comment.captured` + `review-text.captured` for the objection / rebuttal / hook libraries.
- `performance-loop` — joins `scrape.cost.recorded` to `cost-ledger` for per-product test-cost roll-ups.
- `cost-ledger` — receives `scrape.cost.recorded` directly (subset of `cost.recorded`).

## Where this fits in the four-layer model

L1. `product-intelligence` is a *capability* in the CLAUDE.md taxonomy — UI (none yet; results land in `content-dashboard`) + Protocol (the 10 adapter ports + the event schemas) + Runtime (Node service on port 5301) + Persistence (the intake-pipeline + product-registry downstream) + Auth (RAPIDAPI_KEY + per-platform creds via connector-config) + Diagnostics (per-source healthChecks + tos-event auto-pause) + Setup (RAPIDAPI_KEY + connector-config bindings) + Sharp Edges (this README's TOS section).

## Build status checklist

- [x] `manifest.yaml`
- [x] `contracts/product-candidate.ts` (canonical shape + sibling shapes)
- [x] `contracts/events.ts` (all 12 events typed)
- [x] `contracts/adapters/*.ts` (10 source-family ports + `_shared.ts`)
- [x] `contracts/index.ts` (barrel)
- [x] `kb/rapidapi-research.md` (shortlist seed)
- [ ] `docs/diagnostics.runbook.md` (referenced from manifest; follow-up)
- [ ] `docs/sharp-edges.md` (per the capability standard; follow-up)
- [ ] Concrete adapter implementations (follow-up; one PR per source family)
- [ ] Service / router code (none yet — contracts-only scaffold)
