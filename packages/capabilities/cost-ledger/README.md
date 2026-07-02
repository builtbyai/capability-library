# cost-ledger · _planned_

The centralized spend ledger for the library. Any capability that incurs a measurable cost — model tokens, image/video generation seconds, third-party API calls, infra — emits `cost.recorded` here instead of inventing its own counter.

**Emits:** `cost.recorded`, `cost.budget.exceeded`, `cost.report.generated`
**API:** `POST /api/cost/record`, `GET /api/cost/rollup`, `GET /api/cost/budget`, `POST /api/cost/budget`
**Jobs:** `cost-ledger:rollup-daily`, `cost-ledger:rollup-product`
**Depends on:** nothing (L0 capability)

## Why it exists

`@multimarcdown/core` already ships a `CostLedger` class (`packages/core/src/cost-ledger.ts`) that emits `cost.recorded` on the bus. But per the wiring-graph rule, **core is not a capability** — dashboards and downstream caps cannot declare a hard dependency on it through the manifest mechanism (`requires.capabilities`).

That left an architectural hole: capabilities like `product-scoring` (primitive 38, total product-test cost roll-up) and `performance-loop` (primitive 101, per-asset cost-per-result) needed a first-class spend surface to depend on. The DeepSeek V4 audit (`knowledge/decisions/mjb-audit-deepseek-v4.md`) flagged this gap.

Promoting the ledger to a `cost-ledger` capability fixes it: the existing `CostLedger` class becomes the runtime; the capability ships the manifest, contracts, API, jobs, and diagnostics on top.

## What it emits

- `cost.recorded` — every spend event. Canonical 1.0.0 shape pinned below; the in-process `CostLedger` in `@multimarcdown/core` emits the same payload as out-of-process emitters that POST to `/api/cost/record`.
- `cost.budget.exceeded` — when actual spend in a budget-policy window exceeds the configured limit. Includes scope (capability / product / brand-lane / daily / monthly), period bounds, budget vs actual, and the policy's action (alert / throttle / hard-stop).
- `cost.report.generated` — emitted at the end of each rollup job (daily, weekly, per-product). Includes `totalUsd`, `breakdownByOperation`, `breakdownByCapability`, `breakdownByProvider`. Consumed by `session-digest` for review packets.

## Canonical event shape

`cost.recorded` is pinned at schema **version 1.0.0**. The full zod schema lives in `contracts/events.ts` (`CostRecordedSchema`). Payload fields:

| Field | Type | Notes |
|---|---|---|
| `event` | `'cost.recorded'` | Literal. |
| `version` | `'1.0.0'` | Schema version. |
| `occurredAt` | ISO datetime | UTC timestamp the spend was stamped. |
| `capability` | string | Capability id of the emitter (e.g. `media-generation`, `deepseek-router`). |
| `workflowRunId?` | string | Optional `run_...` correlation id from a workflow execution. |
| `productCandidateId?` | string | Optional `pc_...` id from `product-intelligence`. |
| `brandLaneId?` | string | Optional `lane_...` id from `product-registry`. |
| `provider` | string | `rapidapi`, `deepseek`, `replicate`, `anthropic`, `openai`, `ollama`, ... |
| `operation` | string | Finer than category: `product.lookup`, `llm.completion`, `image.generate`, ... |
| `units` | number ≥ 0 | Quantity of the metered unit (tokens, images, seconds, requests). |
| `unitCost` | number ≥ 0 | USD per unit. Soft-invariant: `units * unitCost ≈ totalCost`. |
| `totalCost` | number ≥ 0 | Authoritative billed amount. Trust over `units * unitCost` (e.g. deepseek bills in tokens with non-integer multipliers). |
| `currency` | `'USD'` | Locked to USD in v1. Emitters convert before emitting. |
| `budget?` | `BudgetSnapshot` | Optional snapshot of headroom at emit time: `{ scope: 'perProduct'\|'perBrandLaneDaily'\|'globalDaily', softCap, hardCap, remaining }`. |
| `metadata` | record | Free-form extension; default `{}`. |

Soft-invariant note: `units * unitCost == totalCost` is NOT asserted at the schema level, deliberately.

## Legacy adapter

The pre-1.0.0 shape (`source`, `category`, `amountUsd`, `at`, optional `units` / `unitsKind` / `ref`) is preserved as `CostRecordedLegacySchema` and `costRecordedFromLegacy()` in `contracts/events.ts`, plus `CostLedger.recordLegacy()` in core. Both are marked `@deprecated` and scheduled for removal in **v0.2.0**. New emitters must use the canonical shape directly.

Mapping (legacy → canonical): `source→capability`, `amountUsd→totalCost`, `category→operation` (verbatim), `at→occurredAt`, `provider→'unknown'`, `units→units ?? 1`, `unitCost→amountUsd/units`, `currency→'USD'`, `metadata→{ legacy: true, originalCategory, unitsKind?, ref? }`.

## How other capabilities consume it

**Emitters** (write spend):
- `media-generation` — every image / video / upscale job
- `ai-orchestration` — every multi-strategy reasoning fan-out
- `replicate-api` — every prediction
- `deepseek-router` — every CLI turn (via `ds-cost` analyzer)
- `transcription`, `knowledge-index` — hosted-API calls

**Consumers** (read spend or react):
- `notify` — subscribes to `cost.budget.exceeded` and dispatches via the routing rules
- `media-generation` — checks the ledger pre-flight when `MEDIA_GEN_BUDGET_USD_DAILY` is set; refuses the request if exceeded (throttle / hard-stop action)
- `product-scoring` — joins `cost.recorded.ref=productId` rows to compute total product-test cost (primitive 38)
- `performance-loop` — joins `cost.recorded` with `perf.snapshot.recorded` to compute cost-per-view / cost-per-click / cost-per-purchase (primitive 101)
- `session-digest` — renders `cost.report.generated` into the weekly review packet

## MJB primitives it satisfies

This capability is the missing home for three primitives the audit flagged as gaps:

- **37** — track per-generation cost (model + input + output + product link). The `productCandidateId` field on `cost.recorded` carries the product id (legacy callers used `ref` — adapter remaps); `media-generation` is the emitter, `cost-ledger` is the store.
- **38** — compute total product-test cost (research + sample + generation + page build + distribution). `GET /api/cost/rollup?ref=productId` returns the roll-up.
- **101** — track per-asset cost-per-result (cost/view, cost/click, cost/purchase). `performance-loop` joins ledger entries to perf snapshots; this capability owns the spend half.

## Sharp edges

- **Same-process bus vs cross-process bus.** Today `CostLedger.record()` emits on the in-process `bus` from core. When the ledger runs as a sidecar (its own backend port), emitters in other processes must POST to `/api/cost/record` instead; the API endpoint re-emits on the local bus and persists. Don't let two ledgers run in two processes against the same store — pick one.
- **Budget evaluation is post-hoc.** The ledger only knows spend has exceeded a budget AFTER the `cost.recorded` event lands. For hard-stop semantics, callers must pre-flight via `GET /api/cost/rollup` and refuse before spending. The `cost.budget.exceeded` event is for alerting + throttling future calls, not for blocking the spend that triggered it.
- **No currency normalization.** All amounts are USD. Provider invoices in other currencies must be converted by the emitter before `cost.recorded`.

## Resolved divergences

- **2026-06-29 — core/capability `cost.recorded` shape divergence.** RESOLVED. Pre-1.0.0 the core `CostEntry` used `capabilityId` / `costUSD` / `usage` while the capability `CostRecordedSchema` used `source` / `amountUsd` / `category`. Both now conform to the canonical 1.0.0 shape pinned in [Canonical event shape](#canonical-event-shape) above. Adapters: `costRecordedFromLegacy()` (capability contracts) and `CostLedger.recordLegacy()` (core) bridge the old shape; both `@deprecated`, slated for removal in v0.2.0.
