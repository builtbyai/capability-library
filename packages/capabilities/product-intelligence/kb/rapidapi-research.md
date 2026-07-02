# RapidAPI research — adapter shortlist seed

> Captured 2026-06-29. Source: user's browsing pattern across rapidapi.com between 14:37 and 14:44 local time. The visit count column is the **shortlist signal** — pages the user opened 3+ times indicate adapters they're actively comparison-shopping; pages opened once are first-pass discovery.

## Shortlist table (deduped, sorted by visit count)

| API | Visits | Source family | Likely status |
|-----|-------:|---------------|---------------|
| Amazon Online Data API | 4 | amazon | shortlist |
| Real-Time Amazon Data | 4 | amazon | shortlist |
| Taobao 1688 API | 4 | 1688 + taobao | shortlist |
| Taobao DataHub | 3 | taobao | shortlist |
| TaoBao® API: Search Items & Shops | 3 | taobao | shortlist |
| Amazon Product Info | 3 | amazon | comparison |
| Axesso - Amazon Data Service | 3 | amazon | comparison |
| amazon APIs (index page) | 2 | discovery | — |
| eCommerce | 2 | meta-category | — |
| taobao APIs (index page) | 2 | discovery | — |
| API Hub | 1 | discovery | — |

## What the pattern suggests

- The user is **comparison-shopping Amazon providers** — four candidates with similar visit profiles (4, 4, 3, 3). The first adapter implementation for `amazon` should benchmark at least two of these against each other (cost per call, rate limits, coverage of reviews + competitive listings, regional marketplaces beyond US).
- The user is **leaning hard into CN sourcing** — `Taobao 1688 API` is the highest-priority single provider (covers two source families with one auth setup), backed by `Taobao DataHub` and `TaoBao® API: Search Items & Shops` as comparison candidates. No 1688-only provider in the shortlist; the combined provider is the likely path.
- **No TikTok, Instagram, Reddit, AliExpress, or CSSBuy providers were surfaced in this session.** Those source families need a separate research pass — either the user knows of providers and hasn't visited them recently, or those source families will be served by direct integration / scraping rather than RapidAPI bridges.

## Caveat — what this file is NOT

These are **research candidates the user surfaced via browsing**, not contracts. Before any of these becomes a real `kind: 'rapidapi'` adapter, each provider needs:

1. **Provider docs fetched and read** — auth shape (RapidAPI shared key vs. provider-specific), endpoint coverage, response schema, pagination model.
2. **Rate-limit characteristics measured** — free-tier ceiling, paid-tier pricing per call, burst behavior, cooldown after limit hit.
3. **Coverage benchmarked** — for Amazon: does the adapter cover reviews? Competitive listings? Non-US marketplaces? For Taobao/1688: does it handle image search? Supplier MOQ filtering?
4. **TOS posture noted** — most RapidAPI providers proxy through their own scraping infrastructure, so the user-of-record for TOS purposes is the provider, not us. But provider TOS may still restrict what we can do with the returned data.
5. **Cost-per-call benchmark vs. expected MJB query volume** — if one Amazon scan costs 100 calls and we plan to scan 10 niches daily, that's 1000 calls/day per niche-set; pricing at that scale needs to be a deliberate choice.

The follow-up is `tools/research-rapidapi-provider.md` (does not yet exist) — a checklist for fetching each provider's docs and producing a concrete adapter contract (`packages/capabilities/product-intelligence/contracts/adapters/<source>/<provider-id>.ts`).

## Visit log raw (for traceability)

The visit timestamps + URLs were captured from the user's browser history on 2026-06-29; the deduped table above is the canonical form. If we need to re-derive priorities later (visit counts can shift dramatically week-to-week), pull a fresh snapshot from the user's browser and re-run the dedupe.
