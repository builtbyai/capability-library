# cost-ledger · sharp-edges.md

**What will bite you:** the ledger is the only spend authority in the library, but it is post-hoc, USD-only, sliding-window, and silently degrades when policies are malformed or `ref` is missing. Hard-stop is collaborative — the ledger emits, callers enforce. If you forget any of these the math will be subtly wrong rather than visibly broken, which is the dangerous failure mode.

---

## Edges

### 1. Field-shape divergence between `core/cost-ledger.ts` and the capability's `cost.recorded` event

- **Title:** Two `cost.recorded` payload shapes exist — one in core, one in this capability — and they do not match.
- **Symptom:** Callers using `@multimarcdown/core`'s `CostLedger.record()` produce events with fields `{ entryId, capabilityId, provider, operation, rateCardId, usage, costUSD, externalReportedUSD?, jobId?, at }` (see `packages/core/src/cost-ledger.ts`). The capability's `CostRecordedSchema` (in `contracts/events.ts`) expects `{ event: 'cost.recorded', source, category, amountUsd, units?, unitsKind?, ref?, at }`. A capability subscribing via the capability schema will throw a zod validation error on every core-emitted event, or silently drop it depending on how the bus is wired.
- **Why it happens:** Core shipped first and uses a provider-oriented vocabulary (`provider`, `costUSD`, `capabilityId`); the capability was promoted later with a sink-oriented vocabulary (`source`, `amountUsd`, `category`). README.md acknowledges this with "Mirrors core CostEntry" but the field names actually diverge. The parent agent is currently reconciling this seam — until it ships, expect both shapes on the wire.
- **How to avoid:** Don't validate-strict against `CostRecordedSchema` in the sink yet. Either (a) have the sink accept a relaxed `z.object({ ... }).passthrough()` and normalize internally, or (b) wrap every core `bus.emit('cost.recorded', ...)` call through a translation shim that maps `capabilityId → source`, `costUSD → amountUsd`, `jobId → ref`, and infers `category` from `provider`+`operation`.
- **How to recover:** If you have a backlog of dropped core-shape events, replay them by reading `packages/core/src/cost-ledger.ts`'s in-memory `entries[]` (if the process is still alive) or by parsing emitter logs and POSTing each to `/api/cost/record` in the capability shape. There is no on-disk record of dropped bus events.

---

### 2. Malformed `BudgetPolicy` silently drops cost records

- **Title:** Cost-ledger as sink for `cost.recorded` silently drops events if a budget rule fails to evaluate — emits `cost.dropped` instead.
- **Symptom:** Spend visible in emitter logs never reaches `GET /api/cost/rollup`. Tailing the jsonl shows `cost.dropped` entries with `reason: 'budget-eval-failed'`. Affected scope shows lower totals than reality.
- **Why it happens:** Budget evaluation runs synchronously inside the `cost.recorded` ingest path. If any installed `BudgetPolicy` row has bad data — `limitUsd <= 0`, `periodMs <= 0`, malformed `scopeId` regex (e.g. `scope: 'product'` with `scopeId` not matching `/^prod_[a-z0-9]{12}$/`) — evaluating it throws, and rather than corrupting the rollup with a partially-recorded entry, the ledger drops the inbound event. This is correct conservative behavior but is silent unless you watch for `cost.dropped`.
- **How to avoid:** Validate `BudgetPolicy` strictly with `BudgetPolicySchema.parse(...)` at install time in `POST /api/cost/budget` and reject 4xx. Never write a policy with `limitUsd: 0` (use disable-via-delete instead).
- **How to recover:** `grep cost.dropped "$DATA_DIR/cost-ledger.jsonl"` to find dropped entries; delete the malformed policy via `POST /api/cost/budget` with the corrected row (the install replaces in-scope); replay the dropped entries by re-POSTing to `/api/cost/record`. Dropped events are not auto-resurrected when the bad policy is removed.

---

### 3. Budget periods do not auto-reset on calendar boundary

- **Title:** Sliding window, not calendar window — daily/monthly budgets behave differently than operators expect.
- **Symptom:** A budget with `scope: 'daily'` and `periodMs: 86400000` does not "reset at midnight"; at 23:59 it still includes spend from 00:00 the prior day. Operators watching for a clean daily total see overlapping reads.
- **Why it happens:** `BudgetPolicy.periodMs` is a sliding window (the schema field is literally `Rolling window length in milliseconds`). The ledger computes `actualUsd = sum(entries where at >= now - periodMs)`. There is no anchor to the calendar boundary.
- **How to avoid:** Decide at design time whether sliding or calendar semantics are wanted, and pick the right tool: sliding → use the budget policy; calendar → schedule `cost-ledger:rollup-daily` cron at 00:00 local and consume `cost.report.generated` (which IS calendar-aligned by virtue of its `periodStart`/`periodEnd` being explicitly set by the cron).
- **How to recover:** If existing dashboards depend on calendar semantics that the budget policy doesn't deliver, switch the dashboard to read from the cron-emitted `cost.report.generated` event payloads (or `GET /api/cost/rollup?periodStart=<midnight>&periodEnd=<midnight+24h>` with explicit bounds). Do not mutate `periodMs` semantics — too many callers may be relying on sliding.

---

### 4. Currency assumption is USD-only

- **Title:** Multi-currency would silently break the comparison math; the ledger has no notion of currency.
- **Symptom:** A provider invoice in EUR or CNY gets passed verbatim as `amountUsd` (e.g. `amountUsd: 80` for ¥80 ≈ $11) and the rollup looks 8× too high. Budget breaches fire on phantom spend, or — worse — real breaches stay invisible because the emitter under-converted.
- **Why it happens:** `CostRecordedSchema.amountUsd` is typed `z.number().nonnegative()` with no currency tag. The contract assumes the emitter converted at record time. README.md acknowledges this: "All amounts are USD. Provider invoices in other currencies must be converted by the emitter before `cost.recorded`."
- **How to avoid:** Every emitter that talks to a non-USD-billing provider (1688 RMB, Taobao RMB, some EU AI providers) must apply a conversion at the moment of recording. Conversion rate should be sourced from a rate-card-like config so it isn't hardcoded per emitter.
- **How to recover:** Historical mis-conversion cannot be fixed at the ledger — the entries are append-only and the original currency is lost. Either accept the skew, or write a one-off correction job that emits compensating `cost.recorded` rows with negative-equivalent... except `amountUsd` is `nonnegative()`, so negative-spend isn't representable either. In practice: document the historical skew window and exclude it from rollups consumed by review packets.

---

### 5. Hard-cap is BLOCK + EMIT, not throttle — downstream must subscribe to actually stop

- **Title:** `cost.budget.exceeded` is a notification, not a kill switch.
- **Symptom:** A `hard-stop` budget breach fires `cost.budget.exceeded` once; the emitting capability continues to incur cost indefinitely afterwards. Spend rockets past the limit. Operator sees the alert in `notify` but the bleeding doesn't stop.
- **Why it happens:** The ledger persists the spend that triggered the breach (already-spent money can't be un-spent), emits the event, and stops. The `BudgetPolicy.action: 'hard-stop'` value is metadata — it tells consumers what the operator INTENDED, but the ledger does not enforce process-level blocking. Consumer caps (`media-generation`, `ai-orchestration`, `replicate-api`, `deepseek-router`) must subscribe to `cost.budget.exceeded`, match on `scope`/`scopeId`, and refuse new work themselves.
- **How to avoid:** Every cost-emitting capability that respects budgets MUST register a `bus.on('cost.budget.exceeded', ...)` handler and short-circuit its own job intake when the relevant scope is exceeded. Additionally, pre-flight `GET /api/cost/rollup` before any expensive operation; the event is for future calls, the pre-flight is for the call you're about to make.
- **How to recover:** When an emitter has run past a hard-stop unobserved: (a) manually pause the emitter via its capability surface (most caps expose a pause API), (b) tighten the budget so future breaches surface earlier, (c) audit emitter source to add the missing handler.

---

### 6. Per-product attribution requires `ref` — missing `ref` silently lands in "unattributed"

- **Title:** Cost events without `ref` cannot be attributed to a product; they aggregate into an `unattributed` bucket.
- **Symptom:** Per-product rollups (`GET /api/cost/rollup?scope=product&scopeId=prod_abc123def456`) consistently under-count. Primitive 38 (total product-test cost) and primitive 101 (cost-per-result) under-report. Meanwhile `GET /api/cost/rollup?scope=product&scopeId=unattributed` shows mysterious accumulation.
- **Why it happens:** `CostRecordedSchema.ref` is `optional()`. Emitters that don't have a productId in hand at the moment of recording (e.g. infra costs, generic scrape costs that didn't yet correlate to a product, batched operations) legitimately leave it blank. The ledger has no way to back-attribute later. README.md spells out that `ref` is the correlation field to product/job/generation batch.
- **How to avoid:** Every cost-emitting capability in the MJB commerce pipeline (anything downstream of `product-intelligence` or `product-registry`) MUST plumb the productId through to the moment of `cost.recorded`. Where the workflow batches across products, emit one `cost.recorded` per product with the per-product slice, not one batch entry. `scrape.cost.recorded` from product-intelligence currently uses `runId` — the ledger normalization should map to `ref` AND also resolve runId→productId where the run targeted a specific product.
- **How to recover:** Once spend has landed in the `unattributed` bucket there is no automatic back-attribution. The only reliable fix is to inspect emitter logs, correlate by timestamp + capability + amount, and emit compensating entries. In practice operators just accept the unattributed slice as a tax and improve emitter discipline forward.

---

### 7. Two ledgers in two processes against the same store

- **Title:** Same-process bus and cross-process sidecar wired against the same jsonl produces double-counts or torn writes.
- **Symptom:** Totals are 2× reality; or the jsonl contains lines from interleaved partial writes that fail `JSON.parse` on tail.
- **Why it happens:** Core's `CostLedger` (`packages/core/src/cost-ledger.ts`) emits on the in-process `bus` and holds entries in a local in-memory `entries[]` (no persistence in core). The capability adds persistence via `$DATA_DIR/cost-ledger.jsonl`. If a deployment runs the capability HTTP surface in one process AND another process imports core's `CostLedger` and emits onto a same-process bus that's also wired to the persistence sink, both processes may append to the same file with no locking.
- **How to avoid:** Pick one. Either (a) the capability runs in the same process as every emitter (in-process bus only), or (b) it runs as a sidecar and emitters POST to `/api/cost/record` and stop calling core's `CostLedger.record()` directly. Don't mix.
- **How to recover:** Stop one of the writers. Re-derive the canonical entry list by deduping the jsonl on the natural key `(source, amountUsd, at)` — if two writers were emitting the same logical event you'll see exact duplicates; if they were emitting different events you may have to forensically reconstruct from emitter logs.

---

### 8. Forward-looking dep: cost-ledger has no `requires.capabilities`, but lane-scoped budgets need product-registry

- **Title:** `BudgetPolicy { scope: 'brand-lane', scopeId: '<lane>' }` cannot be evaluated without resolving `event.ref` → product-registry → `Product.brandLane`. The cap declares no such dependency.
- **Symptom:** Lane-scoped policies installed via `POST /api/cost/budget` either no-op (when product-registry is unavailable or `ref` is missing) or evaluate against an empty actual (because the ledger can't resolve which lane the spend was in).
- **Why it happens:** `manifest.yaml requires.capabilities: []` — the ledger is L0 and declares no dependencies. But lane-scoped enforcement is a logical dep on product-registry. The dep isn't manifest-declared because (a) the ledger works fine without it for capability/product/daily/monthly scopes, and (b) declaring it would create an L0↔L2 layering violation (registry depends on cost-ledger per its own manifest).
- **How to avoid:** Treat lane-scoped policies as best-effort. If product-registry is down or returns 404 for the productId, the policy should log "lane resolution failed, skipping" rather than crashing the ingest path. Document this in the policy install UI/CLI.
- **How to recover:** When lane-scoped policies appear to silently no-op, check product-registry health (`curl -fs http://127.0.0.1:5302/api/products?limit=1`) and verify `event.ref` is a valid productId. Re-emit lost evaluations is not possible — sliding window will naturally re-evaluate as new events land.
