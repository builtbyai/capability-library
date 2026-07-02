# product-intelligence · sharp-edges.md

**What will bite you:** ten source adapters with ten different TOS profiles, one shared RapidAPI key, verbatim provider responses in `rawSnapshot`, per-source-port divergent return shapes, and zero downstream dedupe (the registry handles that). Any of these on its own is manageable; together they make the capability a fragile glue layer between TOS-hostile sources and a strict canonical contract. Auto-pause is the safety net; it triggers easily and unpauses manually.

---

## Edges

### 1. TOS bot-detection auto-pauses the offending source — re-enable is MANUAL

- **Title:** Auto-pause is a one-way trip until an operator unpauses; pauseUntil is advisory but the cap does NOT auto-resume.
- **Symptom:** A source family (Amazon, TikTok organic, 1688 are the fastest trippers) goes silent. `GET /api/sources/amazon/health` returns `{ ok: false, reason: 'paused' }` or similar. Scheduler-driven scans for that source no-op. `tos.bot-detection.triggered` fired earlier in the log with a `pauseUntil`.
- **Why it happens:** When an adapter returns `{ ok: false, reason: 'bot-detected' \| 'tos-block' }`, the runtime emits `tos.bot-detection.triggered` and pauses the source family (not just the failing adapter — per README, isolation is per-source-family). The `pauseUntil` field carries the runtime's recommended cool-down (default 30 min first occurrence, exponential thereafter) but the policy choice in this capability is conservative: do not auto-resume because the underlying issue (IP block, account ban, captcha wall, increased detection sensitivity) may persist past pauseUntil and re-tripping would compound the TOS exposure.
- **How to avoid:** Use paid RapidAPI providers as primary for Amazon, TikTok-organic, 1688 (the fastest trippers). Route scraping through residential / rotating proxies at the `connector-config` layer when direct scrape is unavoidable. Throttle `scheduler.job.tick` rates well below the platform's documented limit.
- **How to recover:** Investigate root cause FIRST (check IP block, check account status, check recent platform announcements). Then explicitly unpause: `curl -X POST http://127.0.0.1:5301/api/sources/amazon/pause -d '{"pauseUntil":null}'`. If you unpause without investigating, the cap will re-trip within a few requests and the next auto-pause will be exponentially longer.

---

### 2. Shared `RAPIDAPI_KEY` across all RapidAPI-backed adapters

- **Title:** One bad query can rate-limit every RapidAPI adapter at once.
- **Symptom:** Every `kind: 'rapidapi'` adapter (Amazon, TikTok Shop, Taobao, 1688 may all be on RapidAPI) starts returning `{ ok: false, reason: 'rate-limit' }` simultaneously, with `retryAfterMs` aligned to the RapidAPI account's monthly window reset (not the per-provider window).
- **Why it happens:** `manifest.yaml security.secrets[]: [RAPIDAPI_KEY]` is one key. RapidAPI bills + rate-limits per account, not per provider. A scan that fires 1000 Amazon calls burns the same quota the TikTok Shop scan needed.
- **How to avoid:** Monitor cumulative RapidAPI usage at the account level, not per-adapter. Apply per-adapter request budgets at the runtime layer so no single adapter can monopolize the shared quota. If financially feasible, create multiple RapidAPI accounts and route per-source (the manifest would need to evolve to support `RAPIDAPI_KEY_AMAZON`, `RAPIDAPI_KEY_TIKTOK`, etc.).
- **How to recover:** Throttle the offending caller and wait for the quota reset. Upgrade plan if hit repeatedly. Until then, switch the affected sources to non-rapidapi `kind` (official-api or scrape-browser) if any implementation exists; if not, those sources are dark until reset.

---

### 3. `ProductCandidate.rawSnapshot` is verbatim provider response

- **Title:** `rawSnapshot` carries whatever the provider returned, including potential PII or sensitive fields. Don't blindly emit downstream.
- **Symptom:** Downstream cap (e.g. `content-dashboard`, `ugc-concept-engine`) inadvertently displays or stores buyer emails, seller real names, internal account ids, undisclosed seller addresses, etc. — fields that were in the upstream API response but should not flow further.
- **Why it happens:** `ProductCandidateSchema.rawSnapshot` is `z.record(z.unknown()).default({})` — by contract it is the verbatim provider response, kept so re-extraction can be done without re-fetching. RapidAPI providers vary wildly in what they include; Amazon SP-API responses may include seller internal fields; AliExpress responses may include buyer info on bestseller examples. There is no provider-by-provider whitelist in the contract layer.
- **How to avoid:** Add a sanitization layer at the adapter boundary, not downstream. Strip known-sensitive keys (`email`, `phone`, `address`, `accountId`, `sellerInternalId`) before populating `rawSnapshot`. Document per-source-family what `rawSnapshot` is allowed to contain in this folder (e.g. a future `docs/rawsnapshot-schemas.md`).
- **How to recover:** If sensitive data has already propagated, you need a downstream purge: identify candidates with offending keys (`jq '.candidate.rawSnapshot | keys' < bus.jsonl`), update them via `product.candidate.enriched` with a sanitized patch, and audit any downstream stores (product-registry's `Product.sources[]`, intake-pipeline if `rawSnapshot` was serialized to a blob) for the same fields.

---

### 4. `kind: 'scrape-browser'` adapters require Playwright + Chromium

- **Title:** CI / serverless / minimal-image deployments skip scrape-browser adapters entirely.
- **Symptom:** In some environments, the runtime's `kind` fallback chain (official-api → rapidapi → scrape-http → scrape-browser) never reaches scrape-browser; in those environments the source family appears "broken" but is actually just missing the final fallback. `GET /api/sources` shows `kind: 'scrape-browser'` implementations as `healthy: false, reason: 'playwright-missing'`.
- **Why it happens:** Playwright + Chromium are heavy native deps. Dockerfiles, Cloudflare Workers, AWS Lambda, and most serverless images don't include them. The cap doesn't bundle them — they're an environment prerequisite.
- **How to avoid:** At deployment time, decide whether scrape-browser fallbacks are required. If yes, install Playwright (`npx playwright install chromium`). If no, design the source's adapter priority chain so a non-browser implementation is always available, and accept that scrape-browser is a development-only convenience.
- **How to recover:** If a production incident reveals scrape-browser was the silent dep being relied on, either (a) hot-install Playwright on the running host, or (b) switch the source's primary to a rapidapi provider with a non-zero budget allocation and re-test.

---

### 5. Per-source adapter ports have divergent return shapes — generic consumers must handle the union

- **Title:** `reddit.scan()` returns `{ candidates, painPoints }`; `trends.scan()` returns `TrendSignal[]` (or `HashtagSignalCaptured` payload); amazon returns `ProductCandidate[]`. Generic "scan any source" code paths break.
- **Symptom:** A workflow that wraps every adapter's `scan()` in a generic `for (const source of sources) await scan(source)` loop breaks when it tries to handle the result the same way — `data.painPoints` is undefined for amazon, `data.candidates` is undefined for trends.
- **Why it happens:** The 10 source families produce intrinsically different value: Reddit's value is pain-points + product mentions (different events); trends' value is hashtag-level metrics (no individual products); Amazon's value is the products themselves. The adapter ports were designed source-shaped rather than forced into a single uniform return — README acknowledges this is deliberate to avoid over-fitting.
- **How to avoid:** Don't write generic per-source loops. Either (a) consume the bus events (which ARE uniform — every event has a known schema), or (b) write source-specific orchestrators and accept the duplication. The HTTP API layer is what flattens the divergence by fanning everything onto bus events; downstream caps should subscribe to events, not call `POST /api/sources/:source/scan` and parse the return.
- **How to recover:** If a generic consumer broke, refactor it to consume bus events instead of the synchronous return. The synchronous response of `POST /api/sources/:source/scan` is just `{ runId, status: 'started' }`; the value is on the bus.

---

### 6. Cross-source dedupe is downstream's job — same product across TikTok Shop + Amazon = 2 candidates here

- **Title:** This cap is intentionally lossy in the deduplication dimension; product-registry consolidates.
- **Symptom:** Bus log shows two `product.candidate.discovered` events for clearly the same physical product — one from TikTok Shop, one from Amazon — with different `sourceId`, different `name` (slight variations), maybe different `priceUsd`. Downstream "looks duplicated".
- **Why it happens:** Each source family is a separate adapter port; each adapter emits what its source says. Inferring "this Amazon listing and this TikTok Shop listing are the same product" requires media-hash + name-similarity + cluster-id heuristics, which is product-registry's `POST /api/products/dedupe-check` surface (per `product-registry/README.md`). Doing dedupe here would mean every adapter had to talk to every other adapter, which violates the per-source isolation principle.
- **How to avoid:** Don't expect dedupe here. Expect it downstream: product-registry receives both `product.candidate.discovered` events, runs dedupe-check, and emits one `product.registered` plus one `product.candidate.rejected` (with `reason: 'duplicate'`). The surviving Product gains a second entry in its `sources[]`.
- **How to recover:** If downstream IS NOT deduping (registry down, registry not consuming events), the duplicates are real-time noise. Restore registry consumption; old duplicates can be merged after the fact via `POST /api/products/consolidate`.

---

### 7. Cost attribution requires every adapter to emit `scrape.cost.recorded` — even for cached / free calls

- **Title:** Free or cached calls that skip the cost emit silently break cost-per-result math downstream.
- **Symptom:** `performance-loop`'s cost-per-result metric for a product is suspiciously low — a few cents when reality is dollars. cost-ledger's per-product rollup for that product is missing significant rows.
- **Why it happens:** Adapters that hit a local cache or return a "free" response (RapidAPI cache hit, no-results path, healthcheck that doesn't bill) naturally skip the spend and may also skip the `scrape.cost.recorded` emit. But downstream cost-per-result computes `totalCostUsd / unitsKind` — if calls happen without cost being recorded, the denominator inflates and the per-result number deflates.
- **How to avoid:** Emit `scrape.cost.recorded` for EVERY adapter call, even free ones, with `amountUsd: 0` and the unit count populated. The cost ledger sees `amountUsd: 0` as a legitimate $0 cost; performance-loop sees the units and computes the correct denominator.
- **How to recover:** No retro-fix. The historical cost-per-result for that period will be skewed. Going forward, audit each adapter's code path to ensure no early-return skips the cost emit. Add a unit test: "every code path through `scan()` / `lookup()` / `enrich()` emits exactly one `scrape.cost.recorded`."

---

### 8. `auth-failed` from a RapidAPI adapter is fatal until manual rotation

- **Title:** No automatic retry on `auth-failed` — the key is wrong or revoked and won't fix itself.
- **Symptom:** Adapter returns `{ ok: false, reason: 'auth-failed' }`. Subsequent calls return the same. `scrape.run.failed` events accumulate with `reason: 'auth-failed'`. No `tos.bot-detection.triggered` because this is not a TOS issue.
- **Why it happens:** The runtime treats `auth-failed` as a configuration issue, not a recoverable runtime failure — retrying with the same bad credentials accomplishes nothing and wastes call budget.
- **How to avoid:** Validate `RAPIDAPI_KEY` at process start (a startup probe equivalent to the manifest's `rapidapi-credential` healthcheck). Fail-fast if invalid so misconfiguration is loud, not silent.
- **How to recover:** Rotate the key in RapidAPI Developer Dashboard, update env, restart the cap. There is no in-process recovery.

---

### 9. Per-source pause does NOT propagate across instances

- **Title:** If the cap is horizontally scaled, an auto-pause on one node doesn't pause the others.
- **Symptom:** Node A auto-pauses Amazon after TOS trip; Node B keeps scraping and trips again seconds later, deepening the block.
- **Why it happens:** Pause state is in-memory per process unless explicitly persisted to the connector-config service or a shared store. The contract layer doesn't specify pause-state persistence.
- **How to avoid:** Run the cap single-instance until pause-state persistence is implemented. If multi-instance is required, persist pause state to connector-config (per-source binding with `pausedUntil`) and have every node consult connector-config on each request.
- **How to recover:** Unpause via `POST /api/sources/:source/pause` on each running instance; longer-term, accept the architectural limitation and run single-instance.

---

### 10. `competitiveContext` is `Record<string, unknown>` — schema-free junk drawer

- **Title:** `ProductCandidateSchema.competitiveContext` will grow into chaos exactly like `Product.metadata` does.
- **Symptom:** Different adapters populate `competitiveContext` with different shapes; downstream caps that read it can't write generic code; debugging requires reading each adapter's emit site.
- **Why it happens:** The field is contractually `z.record(z.unknown()).optional()` — explicitly free-form. Useful escape hatch but unbounded.
- **How to avoid:** Document per-source-family what keys are allowed in `competitiveContext` (e.g. in `kb/` alongside `rapidapi-research.md`). Whenever an adapter starts populating a new key, add it to the doc and consider promoting it to a typed sibling field on `ProductCandidateSchema` (which IS a breaking change to a contract every downstream cap depends on — coordinate carefully).
- **How to recover:** If a downstream cap broke because the shape it expected changed, the fix is in the adapter (revert / namespace the new key) and a contract clarification (document the key in this folder).
