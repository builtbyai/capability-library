# product-scoring

L1 MJB capability. The **scoring brain** of the MJB commerce pipeline. Owns the canonical 8-category 1-5 scorecard (`ScoreCategoriesSchema`), the decision-band map (`launch | test | watchlist | weak | reject`), the work-allowance enforcement gate (per-product / per-brand-lane / global budgets via cost-ledger), and the compliance / return-risk red-flag rules.

Status: `planned` (contracts-only scaffold). No service code yet.

## What it is

Every `Product` registered by `product-registry` needs a numeric judgement before downstream capabilities (ugc-concept-engine, funnel-builder, social-distribution) are allowed to spend cycles on it. `product-scoring` is that judgement engine:

1. Subscribes to `product.registered` + `product.updated` from product-registry.
2. Runs the 8-category scorecard (auto via `deepseek-router`, or manual via operator).
3. Looks up the current spend against the configured `WorkAllowancePolicy` (cost-ledger join on `cost.recorded.ref=productId`) and refuses to spend further model budget if the per-product hard cap is breached.
4. Raises `RedFlag` rows for compliance / return-risk hits (primitives 72, 82, 83); a `severity='blocker'` flag forces `decisionState='SKIP'` regardless of total score.
5. Emits `product.scored` with the full `ScoreComputation` payload, plus companion events (`product.decision.tagged`, `supplier.confidence.computed`, `product.margin.computed`, `product.red-flag.raised`, `supplier.rejected`).
6. Calls `POST /api/products/:productId/score` on product-registry to append the entry to the registry's append-only `scoreHistory[]`.

## Why this is a separate capability from `product-registry`

product-registry is the storage spine — it owns the `Product` shape, the score history, the lifecycle. It is intentionally policy-thin: it accepts any `ScoreEntry` that fits the lenient `categories: z.record(z.number().min(1).max(5))` schema. product-scoring is the producer — it owns the strongly-typed 8 categories, the version of the scoring algorithm, the decision-band map, and the cost gates. Splitting producer from store means the scoring algorithm can be re-versioned without touching the registry's persistence layer, and historical entries remain replayable across algorithm changes.

## MJB primitives served

- **19** — Build ranked product opportunity queue from raw candidates (`POST /api/score/rank`).
- **20** — Tag each candidate with first-pass decision (`POST /api/score/triage` → emits `product.decision.tagged` with band='watchlist'|'weak'|'reject' before the full scorecard runs).
- **21** — Score every product 1-5 across 8 categories with decision bands (`POST /api/score/compute`; the bands are `ScorecardSchema.decisionBands`).
- **22** — Compute full landed-cost margin (`POST /api/score/margin` → `MarginComputationSchema`).
- **23** — Compute supplier confidence Low/Med/High (`POST /api/score/supplier-confidence`).
- **71** — Block product if total score < reject floor (band='reject' → `decisionState='SKIP'`).
- **72** — Block product if any hard red flag (severity='blocker' → `decisionState='SKIP'` regardless of total).
- **73** — Block product if margin spread insufficient (MarginComputation feeds into the score; `complianceReturnRisk` / `profitMargin` category drops to 1).
- **74-78** — Compliance blockers raised as red flags (fake claims, fake testimonials, fake scarcity, platform evasion, untracked spend) — emitted via `product.red-flag.raised`.
- **81-83** — Media / supplier / UGC rejection paths (`supplier.rejected` for supplier; the media + UGC rejections live on the consuming caps but the rule vocabulary is owned here).
- **84-85** — Pre-flight checks (funnel link + asset path) — enforced downstream in social-distribution; this capability only scores.
- **86** — Per-decision work-allowance enforcement (`GET /api/score/work-allowance/:productId` returns the current allowance + remaining budget; the scorer self-throttles).
- **87** — Halt automation rollout until manual cadence is repeatable — operator-level gate, not enforced here, but the `globalDaily.hardCap` in `WorkAllowancePolicySchema` is the lever.
- **88** — Sample-order gate (4 conditions confirmed) — composed downstream; this capability provides the supplier-confidence + margin + score signals.
- **92** — Monthly promote/kill/consolidate (`product-scoring:weekly-decision-rollup` job — emits weekly summaries; the monthly cadence is a workflow on top).

## Downstream consumers

- **`product-registry`** — receives the score entry via `POST /api/products/:productId/score` and persists it into `scoreHistory[]`.
- **`ugc-concept-engine`** — refuses to generate concepts for products in `decisionState='SKIP' | 'KILL' | 'ARCHIVED'`.
- **`funnel-builder`** — same gate; only renders funnels for `decisionState in ('TEST', 'BUILD', 'SCALE')`.
- **`social-distribution`** — checks `decisionState` AND `brandLane !== undefined` (primitive 79 on the lane side, the scoring gate on this side).
- **`performance-loop`** — subscribes to `product.scored` to know when a re-test loop closes; uses the `band` + `decisionState` transitions for the monthly rollup.
- **`content-dashboard`** — renders `band` chips on the product table; subscribes to `product.decision.tagged` to refresh per-state operator queues.
- **`session-digest`** — pulls the weekly `product-scoring:weekly-decision-rollup` job output into the review packet.

## Sharp edges

- **Scorecard versioning is load-bearing.** Every `ScoreComputation.scorecardVersion` is stamped on the entry that lands in `product-registry.scoreHistory[]`. Bumping the version (new category, new weight, new band threshold) requires a re-score job (`product-scoring:re-score-on-version-bump`) — but the registry must keep the OLD entries unmodified so primitive 92's month-over-month diffs remain replayable. Never back-fill historical entries against a new version; always emit new entries.
- **Score history is append-only — owned by product-registry, written by us.** This capability does NOT mutate the registry's `scoreHistory[]`. It calls the registry's `POST /api/products/:productId/score` endpoint which appends a `ScoreEntry`. Any code in this capability that touches `scoreHistory` directly is wrong — it bypasses the registry's lifecycle state-machine updates.
- **Decision-state monotonicity rules.**
  - `BUILD → KILL` is allowed without an operator override (perf-loop kills happen via `performance-loop` directly emitting the decision-tag).
  - `BUILD → TEST` requires an explicit operator override and emits `product.decision.tagged` with `taggedBy='operator:user_*'`. The scorer never auto-demotes BUILD to TEST; that would invalidate the work that has already been spent on the BUILD package.
  - `SCALE → KILL` is allowed if the perf bundle warrants (the gate is on performance-loop, not here).
  - `KILL` and `ARCHIVED` are terminal from the scorer's perspective — the scorer refuses to re-score them; only `RETEST` (operator-driven) gets them back into the loop.
  - `SKIP → anything` requires removing the underlying red-flag first (operator path on product-registry).
- **Work-allowance lookups are eventually-consistent.** The `WorkAllowancePolicy` thresholds are local to this capability, but the current spend numbers come from cost-ledger via `cost.recorded.ref=productId` joins. cost-ledger is a sidecar (see its README's "post-hoc evaluation" sharp edge) — a spend that landed in the last few seconds may not yet be reflected in the rollup. Pre-flighting before a large generation batch needs an explicit `GET /api/cost/rollup?ref=productId` and a small safety margin against the hard cap.
- **`supplier.rejected` is advisory, not destructive.** Emitting `supplier.rejected` does NOT unlink the supplier from the product in the registry — the registry only acts on `supplier.unlinked`. The two events are intentionally separate so operators can review rejections before unlinking. Workflows that want auto-unlink must subscribe to `supplier.rejected` and explicitly call the registry's unlink endpoint.
- **Red-flag severity is the SKIP override path.** A `RedFlag` with `severity='blocker'` MUST be paired with a `ScoreComputation.decisionState='SKIP'`. The schema does not enforce this (cross-field invariants live in the service layer); a producer that emits `severity='blocker'` with `decisionState='TEST'` is buggy and the registry should reject the score-append.

## Build status checklist

- [x] `manifest.yaml`
- [x] `contracts/score.ts` (ScoreCategories, Scorecard, ScoreComputation, Margin, SupplierConfidence, WorkAllowancePolicy, RedFlag)
- [x] `contracts/events.ts` (all 6 events typed)
- [x] `contracts/index.ts` (barrel)
- [x] `README.md` (this file)
- [x] `tests/contracts.test.ts` (schema sanity tests)
- [ ] `docs/diagnostics.runbook.md` (referenced from manifest; follow-up)
- [ ] `docs/sharp-edges.md` (per the capability standard; follow-up)
- [ ] Service / router code (none yet — contracts-only scaffold)
- [ ] Persistence adapter (scorecard + work-allowance policy storage)
- [ ] deepseek-router integration (auto-score path)
- [ ] cost-ledger integration (work-allowance lookup + spend pre-flight)
