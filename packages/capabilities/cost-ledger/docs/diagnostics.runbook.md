# cost-ledger · diagnostics.runbook.md

Operational runbook for the `cost-ledger` capability. Covers required environment, expected inputs/outputs, common failures with diagnostic commands, retry policy, budget enforcement behavior, and escalation thresholds.

> Status: `planned` — service code is not yet written. Diagnostic commands assume the capability is running locally on its conventional port (none declared in `manifest.yaml runtime.backend.ports`; assume it inherits the dashboard host port or runs same-process with `@multimarcdown/core`'s `bus`). Commands using `127.0.0.1:5300` below are placeholders for "wherever the ledger HTTP surface is mounted in your deployment" — adjust to match.

---

## 1. Purpose

Centralized spend ledger for the library: every capability that incurs measurable cost (model tokens, image/video generation seconds, third-party API calls, infra usage) emits `cost.recorded` to this sink so spend can be rolled up, budgets enforced, and alerts fired.

---

## 2. Required env vars

`manifest.yaml requires.env[]` is **empty** for cost-ledger. The capability is configuration-driven (budget policies installed via `POST /api/cost/budget`) rather than env-driven, and it has no upstream credentials of its own.

Two implicit operational env vars exist by convention:

| Name | Format | Source |
|---|---|---|
| `DATA_DIR` | Absolute filesystem path (e.g. `/var/lib/multimarcdown` or `C:\Code\CODE_MODULE_LIBRARY\.data`) | Operator chooses; must be writable by the node process. The healthCheck probe `test -f $DATA_DIR/cost-ledger.jsonl` reads it. |
| `COST_LEDGER_DEFAULT_PERIOD_MS` *(optional)* | Integer milliseconds (e.g. `86400000` for 24h) | Operator default for budget policy `periodMs` when the API caller omits it. If unset, every `POST /api/cost/budget` must specify `periodMs` explicitly. |

n/a-justifications:

- No upstream API keys: the ledger does not call any external service. All inputs arrive on the in-process bus or via its own HTTP API.
- No secrets: `manifest.yaml security.secrets[]` is empty.

---

## 3. Expected inputs

### Bus events consumed (sink role)

| Event | Schema (in `contracts/events.ts`) | Notes |
|---|---|---|
| `cost.recorded` | `CostRecordedSchema` | The ledger is itself the publisher of this event name, but the capability also acts as a sink: any other capability that emits `cost.recorded` (via `@multimarcdown/core`'s `CostLedger.record()` in `packages/core/src/cost-ledger.ts`, or via direct `bus.emit('cost.recorded', ...)`) lands in the ledger's persisted store. See sharp-edges.md edge 1 for the field-shape divergence between the core `CostEntry` and the capability `CostRecordedSchema`. |
| `scrape.cost.recorded` *(from product-intelligence)* | `ScrapeCostRecordedEvent` (`packages/capabilities/product-intelligence/contracts/events.ts`) | A subset of `cost.recorded` — the ledger should normalize-and-forward into the canonical `CostRecordedSchema` (mapping `runId` → `ref`, `source` → `source`, no `category` field so the ledger should assign `'third-party-api'`). |

### HTTP API surfaces (from `manifest.yaml provides.api[]`)

| Route | Body / Query | Schema cited |
|---|---|---|
| `POST /api/cost/record` | `CostRecordedSchema` minus `event` literal — `{ source, category, amountUsd, units?, unitsKind?, ref?, at }` | `CostRecordedSchema` (`contracts/events.ts`). The endpoint re-emits on the local bus after validation + persistence. |
| `GET /api/cost/rollup` | Query: `?scope=capability|product|brand-lane|daily|monthly&scopeId=<id>&periodStart=<iso>&periodEnd=<iso>` (all optional; unfiltered = global) | Returns roll-up shape equivalent to `CostReportGeneratedSchema.totalUsd` + `breakdownByCategory` + `breakdownBySource`. |
| `GET /api/cost/budget` | Query: `?scope=...&scopeId=...` (both optional) | Returns array of `BudgetPolicySchema`. |
| `POST /api/cost/budget` | `BudgetPolicySchema` — `{ scope, scopeId, limitUsd, periodMs, action }` | Installs / replaces a budget policy. |

---

## 4. Expected outputs

### Bus events emitted

| Event | Schema | When |
|---|---|---|
| `cost.recorded` | `CostRecordedSchema` | After every accepted `POST /api/cost/record` or after the ledger normalizes an inbound foreign cost event (e.g. `scrape.cost.recorded`). |
| `cost.budget.exceeded` | `CostBudgetExceededSchema` | When evaluation post-`cost.recorded` finds `actualUsd > budgetUsd` inside an active `BudgetPolicy`'s `periodMs` sliding window. Payload: `scope, scopeId, periodStart, periodEnd, budgetUsd, actualUsd, exceededBy`. |
| `cost.report.generated` | `CostReportGeneratedSchema` | At the end of each rollup job (`cost-ledger:rollup-daily`, `cost-ledger:rollup-product`). Includes `reportId` (uuid), `scope` (free-form label like `"product:prod_abc123def456"` or `"daily:2026-06-29"`), period bounds, `totalUsd`, `breakdownByCategory`, `breakdownBySource`. |

### HTTP response shapes

`GET /api/cost/rollup` response (conventional, not in contracts — implementer should mirror `CostReportGeneratedSchema`):

```json
{
  "scope": "product:prod_abc123def456",
  "periodStart": "2026-06-01T00:00:00Z",
  "periodEnd":   "2026-06-29T23:59:59Z",
  "totalUsd": 14.27,
  "breakdownByCategory": { "ai-tokens": 4.10, "ai-image": 8.40, "ai-video": 1.77 },
  "breakdownBySource":  { "deepseek-router": 4.10, "media-generation": 10.17 }
}
```

---

## 5. Common failures

| Symptom | Likely cause | Diagnostic command | Recovery action |
|---|---|---|---|
| Healthcheck `ledger-store-present` fails | `DATA_DIR` unset or unwritable; `cost-ledger.jsonl` never created. | `bash -c 'ls -la "$DATA_DIR/cost-ledger.jsonl" 2>&1; echo DATA_DIR=$DATA_DIR'` | Set `DATA_DIR` env, ensure node process owner has write; touch the file to warm-start: `touch "$DATA_DIR/cost-ledger.jsonl"`. |
| `cost.recorded` events emit but never appear in rollups | Sink subscriber not registered (two-process deployment, see sharp-edges edge 7). | `curl -s http://127.0.0.1:5300/api/cost/rollup \| head -40` then compare with emitter logs grep `cost.recorded`. | Confirm only one process owns the persistence path. If running as a sidecar, emitters must `POST /api/cost/record` rather than `bus.emit` in their own process. |
| `POST /api/cost/record` returns 400 "schema validation failed" | Field-shape divergence between core `CostEntry` and capability `CostRecordedSchema` (see sharp-edges edge 1). Caller is using `capabilityId`/`costUSD`/`entryId` shape from `packages/core/src/cost-ledger.ts`. | `curl -i -X POST http://127.0.0.1:5300/api/cost/record -H 'content-type: application/json' -d '{"source":"deepseek-router","category":"ai-tokens","amountUsd":0.0023,"at":"2026-06-29T12:00:00Z"}'` | Map caller fields → contract: `capabilityId` → `source`, `costUSD` → `amountUsd`, `jobId` → `ref`, `at` already matches. See sharp-edges.md for the seam reconciliation. |
| Budget policy installed but `cost.budget.exceeded` never fires | Policy `periodMs` is a sliding window — if the window is larger than the inspection range, you may simply not yet have crossed it. Or scope mismatch (`product` scope policy but emitters omit `ref`, so spend lands in `unattributed`). | `curl -s "http://127.0.0.1:5300/api/cost/budget?scope=product&scopeId=prod_abc123def456"` and `curl -s "http://127.0.0.1:5300/api/cost/rollup?scope=product&scopeId=prod_abc123def456"` | Verify the rollup `totalUsd` exceeds `limitUsd` within `periodMs`. If `unattributed` bucket has the spend, fix emitters to send `ref=<productId>` (see sharp-edges edge 6). |
| `cost.dropped` events appearing in logs | Malformed `BudgetPolicy` row failed evaluation (see sharp-edges edge 2). The ledger drops the inbound cost event rather than corrupting downstream rollups. | `curl -s http://127.0.0.1:5300/api/cost/budget \| jq '.[] \| select(.limitUsd <= 0 or .periodMs <= 0)'` | Delete or correct the malformed policy via `POST /api/cost/budget` with the fixed row. |
| Downstream cap (e.g. `media-generation`) keeps spending after `cost.budget.exceeded` fires | `cost.budget.exceeded` is **BLOCK + EMIT, not throttle** — the ledger only notifies. Downstream cap must subscribe and self-throttle. | `grep -i 'cost.budget.exceeded' <media-generation log>` then check whether the cap registered a handler. | Confirm consumer cap has subscribed via `bus.on('cost.budget.exceeded', ...)`. Pre-flight check (`GET /api/cost/rollup`) is the only way to hard-stop the spend that triggered the event — the event itself is for future calls. |
| Rollup totals look "stale" near calendar boundary | Budget periods are sliding windows, not calendar-aligned (see sharp-edges edge 3). A "daily" policy at `periodMs=86400000` measures the last 24h, not the calendar day. | `curl -s "http://127.0.0.1:5300/api/cost/rollup?periodStart=2026-06-29T00:00:00Z&periodEnd=2026-06-29T23:59:59Z"` (explicit calendar bounds) | If calendar-aligned semantics are required, schedule the `cost-ledger:rollup-daily` cron at 00:00 local and consume `cost.report.generated` rather than reading rollups ad-hoc. |
| Cost totals look wrong for non-USD providers | All amounts are USD; multi-currency would break comparison math (see sharp-edges edge 4). Emitter passed a number in the provider's local currency without converting. | `curl -s http://127.0.0.1:5300/api/cost/rollup \| jq '.breakdownBySource'` and cross-check against provider invoices. | Fix the emitter to convert at record time. There is no retro-fix at the ledger layer; either re-emit corrected entries or accept the skew in historical data. |
| `cost.recorded` fires but `ref` field missing — spend appears in "unattributed" bucket | Emitter didn't pass `ref=<productId>` (see sharp-edges edge 6). | `curl -s "http://127.0.0.1:5300/api/cost/rollup?scope=product&scopeId=unattributed"` | Update emitter to include `ref`. No back-fill possible without provider-side correlation ids. |

---

## 6. Retry policy

| Job / handler | Retry behavior | Hard-stop trigger |
|---|---|---|
| `POST /api/cost/record` ingest | None at HTTP layer — a 4xx is the caller's bug (malformed payload, see edge 1); a 5xx returns immediately and the caller is expected to retry with their own back-off. | n/a |
| Inbound bus `cost.recorded` sink | None — bus delivery is best-effort, in-process. If the sink throws during persistence the event is logged as `cost.dropped` (edge 2) and NOT retried. | Persistence write failure (disk full, FS read-only) → emit `cost.dropped`, do not retry, do not crash the bus. |
| `cost-ledger:rollup-daily` | Cron-driven; on failure the next scheduled run picks up. No same-run retry. | n/a |
| `cost-ledger:rollup-product` | Same as above — cron-driven, no same-run retry. | n/a |
| Budget evaluation (post-`cost.recorded`) | None — evaluation is synchronous in the record handler. Failure (bad policy) emits `cost.dropped` for the triggering event. | n/a |

---

## 7. Budget behavior

The ledger is the **single source of truth** for `cost.budget.exceeded`. It does not throttle or block on its own — it emits, and consumer capabilities decide whether to stop.

### Scope precedence

When a `cost.recorded` event lands, the ledger evaluates all installed `BudgetPolicy` rows whose scope matches:

| Scope | Matching rule | Example |
|---|---|---|
| `capability` | `policy.scopeId === event.source` | policy on `media-generation` matches all events with `source: 'media-generation'`. |
| `product` | `policy.scopeId === event.ref` | policy on `prod_abc123def456` matches events with `ref: 'prod_abc123def456'`. **Requires `ref` to be set** (see sharp-edges edge 6); missing `ref` → matches the `unattributed` bucket only. |
| `brand-lane` | `policy.scopeId === <lane>` resolved via product-registry (`Product.brandLane`). | Requires `ref` to be a productId AND the registry to be reachable for the resolve. If unreachable, lane-scoped policies degrade to no-op for that record. |
| `daily` | `policy.scopeId === <ISO date>` (e.g. `2026-06-29`). | Bucket key derived from `event.at`. |
| `monthly` | `policy.scopeId === <ISO month>` (e.g. `2026-06`). | Bucket key derived from `event.at`. |

### Period semantics

`BudgetPolicy.periodMs` is a **sliding window**. The ledger sums all `cost.recorded` entries where `at >= (now - periodMs)` and the scope matches. There is no auto-reset at midnight or month-start — sharp-edges edge 3.

### Action handling

`BudgetPolicy.action` is one of:

| Action | Ledger behavior | Consumer obligation |
|---|---|---|
| `alert` | Emit `cost.budget.exceeded` and stop. | `notify` capability subscribes and dispatches per its routing rules. |
| `throttle` | Emit `cost.budget.exceeded`; no rate-limit enforcement happens at the ledger. | Emitting capability is expected to subscribe and slow itself (e.g. defer non-urgent jobs). |
| `hard-stop` | Emit `cost.budget.exceeded`; ledger does NOT block the triggering event (it's already spent). | Emitting capability MUST subscribe and refuse new spend in the same scope until the next period boundary OR until pre-flight check via `GET /api/cost/rollup` shows below limit. |

**Critical:** the event that triggered the budget breach is always persisted. The ledger never refuses a `cost.recorded` ingest on budget grounds — refusing would distort future rollups. Hard-stop is enforced by callers doing pre-flight reads, NOT by the ledger.

### Per-product, per-lane, global cap interaction

When multiple policies match a single `cost.recorded` event (e.g. global `daily` + `product:<id>` + `capability:media-generation` all overlap), each is evaluated independently and each can fire its own `cost.budget.exceeded`. Consumers must dedupe at their layer if they only want one alert per breach.

---

## 8. Diagnostic commands

Health checks from `manifest.yaml diagnostics.healthChecks[]`:

```bash
# 1. Ledger store present (file-system probe)
bash -c 'test -f "$DATA_DIR/cost-ledger.jsonl" && echo OK || echo MISSING'
```

State dumps:

```bash
# 2. Global rollup (no scope filter, returns everything)
curl -s http://127.0.0.1:5300/api/cost/rollup | head -60

# 3. Per-product rollup
curl -s "http://127.0.0.1:5300/api/cost/rollup?scope=product&scopeId=prod_abc123def456"

# 4. Per-capability rollup (e.g. all media-generation spend)
curl -s "http://127.0.0.1:5300/api/cost/rollup?scope=capability&scopeId=media-generation"

# 5. Daily rollup explicit calendar bounds (work around sliding-window semantics)
curl -s "http://127.0.0.1:5300/api/cost/rollup?periodStart=2026-06-29T00:00:00Z&periodEnd=2026-06-29T23:59:59Z"

# 6. List all budget policies
curl -s http://127.0.0.1:5300/api/cost/budget | jq .

# 7. Filter budget policies by scope
curl -s "http://127.0.0.1:5300/api/cost/budget?scope=product"

# 8. Spot-check the unattributed bucket (events missing `ref`)
curl -s "http://127.0.0.1:5300/api/cost/rollup?scope=product&scopeId=unattributed"

# 9. Smoke-test a record (manual ingest)
curl -i -X POST http://127.0.0.1:5300/api/cost/record \
  -H 'content-type: application/json' \
  -d '{"source":"manual-smoke","category":"other","amountUsd":0.01,"ref":"smoke-test","at":"2026-06-29T12:00:00Z"}'

# 10. Install a per-product daily budget
curl -i -X POST http://127.0.0.1:5300/api/cost/budget \
  -H 'content-type: application/json' \
  -d '{"scope":"product","scopeId":"prod_abc123def456","limitUsd":25.00,"periodMs":86400000,"action":"hard-stop"}'

# 11. Tail the ledger jsonl directly (raw events, append-only)
tail -F "$DATA_DIR/cost-ledger.jsonl" | jq -c '. | {source, category, amountUsd, ref}'

# 12. Check whether dropped events have accumulated
grep -c 'cost.dropped' "$DATA_DIR/cost-ledger.jsonl" 2>/dev/null || echo 0
```

---

## 9. Escalation

Escalate to human operator when:

| Signal | Why |
|---|---|
| `cost.dropped` events appear in volume (>10/hour) | A budget policy is malformed AND it's silently dropping cost records — rollups and budget enforcement are both degraded until the policy is fixed. Operator must reconcile the missing entries from emitter logs. |
| Any `hard-stop` `cost.budget.exceeded` fires AND emitter continues spending (visible via tailing the jsonl) | The emitter capability has not subscribed to the exceeded event. Operator must either patch the emitter or manually pause it via its capability surface. |
| Rollup vs provider-invoice variance > 10% over a calendar month | Indicates either currency-conversion errors (edge 4), missing `cost.recorded` emits from one of the integrations, or duplicated entries (e.g. both `bus.emit` AND `POST /api/cost/record` from the same emitter). Requires manual reconciliation. |
| `ledger-store-present` healthcheck flapping | Disk pressure or permissions regression; risks losing future spend records. Page on-call. |
| Multi-currency entries appearing in `cost.recorded` (e.g. amounts that look like ¥ values without USD conversion) | Future-breaking — comparison math will be silently wrong. Operator must identify the offending emitter and patch its conversion logic. |
