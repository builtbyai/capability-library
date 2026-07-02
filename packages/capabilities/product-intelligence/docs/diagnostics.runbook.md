# product-intelligence · diagnostics.runbook.md

Operational runbook for the `product-intelligence` capability. Covers env, expected I/O, common failures with diagnostic commands, retry policy, budget interaction, and escalation thresholds.

> Status: `planned` — contracts-only scaffold. Service code is not yet written. Diagnostic commands target the conventional service port `5301` declared in `manifest.yaml runtime.backend.ports`.

---

## 1. Purpose

External product / supplier / social data ingress: owns 10 source-family adapters (TikTok Shop, TikTok organic, Amazon, Instagram, Reddit, AliExpress, 1688, Taobao, CSSBuy, hashtag trends) and emits a canonical `ProductCandidate` shape with per-source TOS-isolation discipline.

---

## 2. Required env vars

From `manifest.yaml requires.env[]`:

| Name | Format | Source |
|---|---|---|
| `RAPIDAPI_KEY` | 50-character key, format `[a-zA-Z0-9]{50}` | RapidAPI Developer Dashboard → My Apps → default-application → "x-rapidapi-key" header. One key is shared across every RapidAPI-backed adapter (Amazon, TikTok, Taobao, 1688). |

Implicit / conventional env vars (not in manifest but expected by adapter implementations):

| Name | Format | Source |
|---|---|---|
| `REDDIT_OAUTH_CLIENT_ID` / `REDDIT_OAUTH_CLIENT_SECRET` *(when reddit adapter is `kind: 'official-api'`)* | OAuth credentials | reddit.com → preferences → apps → create another app → script |
| `INSTAGRAM_GRAPH_TOKEN` *(when instagram adapter is `kind: 'official-api'`)* | Long-lived token | Meta developer console → Graph API explorer |
| `AMAZON_SP_API_*` *(when amazon adapter is `kind: 'official-api'`)* | SP-API credentials | Amazon Seller Central |
| `CONNECTOR_CONFIG_URL` | http URL to connector-config service | Per the `requires.capabilities: [connector-config]` dep, this capability fetches per-platform bindings from there rather than reading env directly for platform creds. |

n/a-justifications:

- `manifest.yaml security.secrets[]: [RAPIDAPI_KEY]` is the only declared secret; per-platform creds live behind `connector-config` to allow lane-scoped routing (one creds set per brand-lane is the MJB pattern).

---

## 3. Expected inputs

### HTTP API surfaces (from `manifest.yaml provides.api[]`)

| Route | Body / params | Schema cited |
|---|---|---|
| `POST /api/sources/:source/scan` | Source-family specific scan params (e.g. `RedditScanParams` in `contracts/adapters/reddit.ts`, `AmazonScanParams` in `amazon.ts`, etc.). `:source` is one of the 10 `SourceFamily` enum values. | Per-adapter `Scan{Source}Params` interface in `contracts/adapters/<source>.ts`. |
| `POST /api/sources/:source/lookup` | Source-family lookup params (e.g. `RedditLookupParams` `{ ref }`). | Per-adapter `{Source}LookupParams` interface. |
| `GET /api/sources` | n/a | Returns array of registered adapter implementations with `{ id, source, kind, healthy, lastHealthCheckAt }`. |
| `GET /api/sources/:source/health` | n/a | Returns `AdapterHealth` (`contracts/adapters/_shared.ts`): `{ ok, reason?, rateLimit?: { remaining, resetAt } }`. |
| `POST /api/sources/:source/pause` | `{ pauseUntil?: ISO8601, reason?: string }` | Manually pauses a source family; mirrors what `tos.bot-detection.triggered` auto-does. |
| `GET /api/runs/:runId` | n/a | Returns the run record `{ runId, source, adapterId, status, candidatesEmitted, painPointsEmitted, ..., startedAt, completedAt? }`. |
| `GET /api/products/:productId` | n/a | Returns the most recent ProductCandidate matched to that productId (cross-resolve through product-registry's `Product.sources[].candidateId`). |

### Bus events consumed

| Event | Producer | Why |
|---|---|---|
| `connector.config.changed` *(from connector-config, inferred)* | connector-config | Per-platform creds rotate; adapters must re-load bindings. |
| `scheduler.job.tick` *(from scheduler)* | scheduler | Drives `product-intelligence:rapidapi-poll` cron-style intake. |

---

## 4. Expected outputs

### Bus events emitted (from `manifest.yaml provides.events[]`)

| Event | Schema | When |
|---|---|---|
| `product.candidate.discovered` | `ProductCandidateDiscoveredEvent` | Each item produced by `scan()` or `lookup()` after normalization to `ProductCandidateSchema`. |
| `product.candidate.enriched` | `ProductCandidateEnrichedEvent` | After `enrich()` returns a partial patch; carries the diff, not the full candidate. |
| `supplier.candidate.found` | `SupplierCandidateFoundEvent` | When AliExpress / 1688 / Taobao / CSSBuy `lookup()` returns a `SupplierCandidate` matching an upstream productCandidateId. |
| `pain-point.captured` | `PainPointCapturedEvent` | Reddit / TikTok-organic / Amazon-review mining output. Distinct from `comment.captured`. |
| `comment.captured` | `CommentCapturedEvent` | Raw comment text, source-attributed, for ugc-concept-engine objection bank. |
| `review-text.captured` | `ReviewTextCapturedEvent` | Raw review body (vs. aggregated `ReviewSummary` on the candidate). |
| `hashtag-signal.captured` | `HashtagSignalCapturedEvent` | trends adapter output: platform + tag + niche + free `metrics` record. |
| `tos.bot-detection.triggered` | `TosBotDetectionTriggeredEvent` | Adapter returned `{ ok: false, reason: 'bot-detected' \| 'tos-block' }`. Includes `pauseUntil` ISO timestamp. |
| `scrape.run.started` | `ScrapeRunStartedEvent` | At the top of every scan/lookup invocation. |
| `scrape.run.completed` | `ScrapeRunCompletedEvent` | After the adapter call returns `ok: true`; carries counts + durationMs. |
| `scrape.run.failed` | `ScrapeRunFailedEvent` | Adapter returned `ok: false`; `reason` mirrors `AdapterFailure.reason`. |
| `scrape.cost.recorded` | `ScrapeCostRecordedEvent` | Per adapter call; ingested by cost-ledger as a subset of `cost.recorded`. |

### API response shapes

`POST /api/sources/:source/scan` returns:

```json
{
  "runId": "uuid",
  "status": "started"
}
```

— the candidates / pain-points / comments are emitted on the bus, not synchronously returned. Per-source adapter divergences exist: `reddit.scan` returns `{ candidates, painPoints }` from the adapter port, `trends.scan` returns `TrendSignal[]`, etc. The HTTP API normalizes by fanning everything onto bus events; the response is just the run handle.

---

## 5. Common failures

| Symptom | Likely cause | Diagnostic command | Recovery action |
|---|---|---|---|
| `GET /api/sources/:source/health` returns `{ ok: false, reason: 'auth-failed' }` for every RapidAPI-backed source | `RAPIDAPI_KEY` missing, expired, or revoked. Shared across ALL RapidAPI adapters. | `curl -fs https://rapidapi.com -H "x-rapidapi-key: $RAPIDAPI_KEY"` (the manifest's healthCheck probe) | Regenerate key in RapidAPI Developer Dashboard; rotate via env; restart the cap. Until rotated, ALL rapidapi-kind adapters fail — non-rapidapi implementations of the same source (e.g. `amazon:sp-api`) still work. |
| Source family auto-paused, never resumes | `tos.bot-detection.triggered` fired and re-enable is MANUAL (sharp-edges edge 1). `pauseUntil` is advisory; the cap doesn't auto-resume on its own. | `curl -s http://127.0.0.1:5301/api/sources \| jq '.[] \| select(.source=="amazon")'` (shows pause state) | After investigating root cause (rate, IP, account ban), explicitly unpause: `curl -X POST http://127.0.0.1:5301/api/sources/amazon/pause -d '{"pauseUntil":null}'`. Resuming without identifying root cause will re-trip immediately. |
| All RapidAPI adapters rate-limited simultaneously | Shared `RAPIDAPI_KEY` quota burned by one greedy adapter (sharp-edges edge 2). | `curl -fs https://rapidapi.com -H "x-rapidapi-key: $RAPIDAPI_KEY"` plus inspect per-adapter `rateLimit.remaining` via `GET /api/sources/<src>/health`. | Either upgrade plan, or split per-source RapidAPI keys (requires creating multiple RapidAPI accounts; the manifest assumes one key). Throttle the offending caller. |
| `product.candidate.discovered` events validate-fail downstream | `ProductCandidateSchema` mismatch — adapter implementation drifted from contract. | `grep 'product.candidate.discovered' <log> \| jq '.candidate' \| <pipe to zod validator>` | Pin adapter to `contracts/product-candidate.ts` shapes; never let an adapter return a partial without `Partial<ProductCandidate>` wrap. |
| `connector-config` unreachable; per-platform adapters fail with cred-resolution errors | `requires.capabilities: [connector-config]` dep down. | `curl -fs http://<connector-config host>/api/health` | Bring connector-config back online; this cap caches last-known bindings but only for the in-memory lifetime — on cold start with connector-config down, adapters cannot initialize. |
| `scrape.cost.recorded` never appears for free / cached calls | Adapter only emits cost when a paid request actually fires (sharp-edges edge 7). Cost-per-result math under-counts (free calls look infinitely-cheap). | `grep -c 'scrape.cost.recorded' <log>` vs `grep -c 'scrape.run.completed' <log>` — should be roughly equal. | Patch adapter to always emit `scrape.cost.recorded` with `amountUsd: 0, units: 0` for cached / free calls so the rate-per-result denominator is correct. |
| `kind: 'scrape-browser'` adapters refuse to start in CI / serverless | Playwright / Chromium missing (sharp-edges edge 4). | `which chromium 2>/dev/null \|\| echo MISSING; npx playwright --version 2>/dev/null \|\| echo NO_PLAYWRIGHT` | Either install Playwright + Chromium in that env, or accept that scrape-browser fallbacks are unavailable; the runtime should auto-skip them and surface `{ ok: false, reason: 'transient' }` from healthCheck. |
| Duplicate candidates emitted across sources for the same product | Cross-source dedupe is downstream (sharp-edges edge 6). TikTok Shop entry + Amazon entry of the same product produce 2 `product.candidate.discovered`. | `grep 'product.candidate.discovered' <log> \| jq -s 'group_by(.candidate.name) \| map(select(length>1))'` | Not a bug here — `product-registry`'s dedupe-check is the consolidator. Verify registry is consuming the events and emitting `product.candidate.rejected` with `reason: 'duplicate'` for the duplicates. |
| `rawSnapshot` field carries provider-side PII or sensitive content into downstream caps | Verbatim provider response is preserved by contract (sharp-edges edge 3). | `grep 'rawSnapshot' <event log> \| jq '.candidate.rawSnapshot \| keys'` | Add a sanitization pass before re-emit: strip known PII keys (emails, addresses, account ids) at the adapter boundary, not downstream. Document allowed keys per source family. |
| `1688` / `taobao` scans return persistent `bot-detected` from non-CN IPs | Source-family TOS profile: 1688 essentially non-viable from non-CN egress (README.md). | `curl -fs https://1688.com -o /dev/null -w '%{http_code}\n'` from the runtime host | Switch to a RapidAPI provider that proxies through CN egress (the `Taobao 1688 API` shortlisted in README is the planned primary), or use CSSBuy as fallback. Direct scraping is not a viable recovery. |
| `reddit` adapter hard-throttles instead of bot-detecting | Reddit's 2023 policy change: no bot-detection, just rate-limits (README.md). | `curl -fs https://oauth.reddit.com/api/v1/me -H "Authorization: Bearer $REDDIT_OAUTH_TOKEN"` shows `x-ratelimit-remaining` header. | OAuth is required for production-grade rate limits; if currently using anon scrape fallback, switch to OAuth flow. |

---

## 6. Retry policy

| Job / handler | Retry behavior | Hard-stop trigger |
|---|---|---|
| `product-intelligence:scan-source` | On `AdapterFailure.reason='transient'`: retry with `retryAfterMs` from the adapter (default 5s, exponential up to 60s, max 5 attempts). | `reason='auth-failed'` → no retry, emit `scrape.run.failed`, alert. `reason='bot-detected'` or `tos-block` → no retry, emit `tos.bot-detection.triggered` with `pauseUntil = now + 30min` (exponential on repeat). |
| `product-intelligence:scan-source` cross-implementation fallback | On hard failure, runtime falls forward to the next `kind` priority (`official-api > rapidapi > scrape-http > scrape-browser`) within the same source family. NOT to a different source family. | All implementations in the same port exhausted → emit `scrape.run.failed` with `reason='unknown'`. |
| `product-intelligence:rapidapi-poll` | Scheduler-driven; on failure the next tick picks up. No same-tick retry. Honors per-source pause state. | n/a |
| `product-intelligence:enrich-candidate` | One retry on `transient`; otherwise emit `product.candidate.enriched` with an empty patch (no-op) to signal the enrichment pass completed. | Same as scan-source for `bot-detected` / `tos-block`. |

---

## 7. Budget behavior

product-intelligence emits `scrape.cost.recorded` per adapter call. cost-ledger receives this as a subset of `cost.recorded`. Budget interactions:

- **Per-source pause on budget breach is NOT automatic.** When cost-ledger emits `cost.budget.exceeded` with `scope: 'capability', scopeId: 'product-intelligence'`, this capability should subscribe and apply self-throttle: defer or refuse new scan jobs from the scheduler. The capability does not have native budget integration — the subscription must be wired explicitly.
- **Per-product budget** (`scope: 'product', scopeId: <productId>`): requires every `scrape.cost.recorded` to carry a `ref` correlating to the productId. Currently `ScrapeCostRecordedEvent` uses `runId` (uuid) — the ledger ingest must resolve runId → productId via the run record. If the run wasn't product-bound (e.g. trends scan, generic Reddit niche scan), the spend lands in the `unattributed` bucket on the ledger side.
- **Per-brand-lane budget**: lane is resolved through product-registry; same gotcha as cost-ledger sharp-edges edge 8.
- **Free / cached calls undercount.** See sharp-edges edge 7: adapters must emit `scrape.cost.recorded` with `amountUsd: 0` for cached responses or the cost-per-result denominator breaks.

---

## 8. Diagnostic commands

Health checks from `manifest.yaml diagnostics.healthChecks[]`:

```bash
# 1. RapidAPI credential probe (the manifest's rapidapi-credential check)
curl -fs https://rapidapi.com -H "x-rapidapi-key: $RAPIDAPI_KEY" \
  && echo OK || echo BAD_KEY

# 2. Source router up (the manifest's source-router-up check)
curl -fs http://127.0.0.1:5301/api/sources | jq 'length'
```

State / behavior probes:

```bash
# 3. List all registered adapter implementations + their kind + last health
curl -s http://127.0.0.1:5301/api/sources | jq '.[] | {id, source, kind, ok: .healthy}'

# 4. Per-source health (includes rateLimit when adapter exposes it)
curl -s http://127.0.0.1:5301/api/sources/amazon/health | jq .

# 5. Inspect a specific run
curl -s http://127.0.0.1:5301/api/runs/<runId> | jq .

# 6. Manually trigger a reddit niche scan
curl -i -X POST http://127.0.0.1:5301/api/sources/reddit/scan \
  -H 'content-type: application/json' \
  -d '{"subreddit":"pets","niche":"pet","limit":25}'

# 7. Pause a source family for 1h (mirrors auto-pause from tos.bot-detection.triggered)
curl -i -X POST http://127.0.0.1:5301/api/sources/amazon/pause \
  -H 'content-type: application/json' \
  -d "{\"pauseUntil\":\"$(date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)\",\"reason\":\"manual ops pause\"}"

# 8. Unpause (set pauseUntil to null / past)
curl -i -X POST http://127.0.0.1:5301/api/sources/amazon/pause \
  -H 'content-type: application/json' \
  -d '{"pauseUntil":null}'

# 9. Lookup a candidate by productId (resolves via product-registry sources[])
curl -s http://127.0.0.1:5301/api/products/prod_abc123def456 | jq .

# 10. Tail bus events emitted by this cap (when using the dashboard's local bus log)
tail -F "$DATA_DIR/bus.jsonl" | jq -c 'select(.event | startswith("product.") or startswith("scrape.") or startswith("tos.") or startswith("pain-point.") or startswith("comment.") or startswith("review-text.") or startswith("hashtag-signal."))'

# 11. Count auto-pause events in the last 24h
grep tos.bot-detection.triggered "$DATA_DIR/bus.jsonl" 2>/dev/null | \
  jq -c 'select(.detectedAt >= "'"$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)"'")' | \
  wc -l

# 12. Spot adapter cost emission gap (should approximately equal completed-run count)
RUNS=$(grep -c scrape.run.completed "$DATA_DIR/bus.jsonl")
COSTS=$(grep -c scrape.cost.recorded "$DATA_DIR/bus.jsonl")
echo "runs=$RUNS costs=$COSTS (delta should be ~0 if cost emit discipline is good)"
```

---

## 9. Escalation

Escalate to human operator when:

| Signal | Why |
|---|---|
| `tos.bot-detection.triggered` fires for the same `source` 3+ times in a 24h window | Recurring TOS trips on the same source indicate the chosen adapter implementation is no longer viable; operator needs to evaluate switching to a different `kind` (rapidapi → official-api, or scrape-browser → rapidapi) or accepting that source family as degraded. |
| `auth-failed` from RapidAPI-backed adapter | `RAPIDAPI_KEY` is shared infra — rotation is a coordinated operator action; cannot be self-healed by the runtime. |
| A `product.candidate.discovered` event contains `rawSnapshot` with provider PII (emails, addresses, real names) | sharp-edges edge 3 — sanitization is missing and downstream caps may inadvertently store or display PII. Patch and audit downstream consumers' stores. |
| `kind: 'scrape-browser'` adapters consistently fail in production environment | Playwright/Chromium availability is environmental — operator decision whether to (a) install the dependency or (b) accept the source family as RapidAPI-only. |
| Cross-source duplicate rate (same product appearing in N adapters) trends up without product-registry dedupe rate following | The downstream consolidation is broken — escalate to product-registry team; until fixed, downstream caps consume duplicate work. |
| 1688 / taobao success rate drops to 0 from non-CN deployment | Expected per README — but operator should be aware whether the deployment was supposed to have CN egress. |
