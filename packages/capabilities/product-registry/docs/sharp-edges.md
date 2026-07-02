# product-registry · sharp-edges.md

**What will bite you:** the registry is the L1 product spine — ~40 of the 102 MJB primitives depend on its shapes. Any contract drift cascades. Append-only history, breaking-vs-non-breaking field changes, destructive consolidation, dedupe-confidence bands, async cluster assignment, and an open-ended `metadata` field all conspire to make "fix it later" the wrong default. Most edges below are about NOT breaking downstream consumers when the registry itself is doing reasonable things.

---

## Edges

### 1. Score history is append-only — no delete, no edit

- **Title:** ScoreEntries are immutable; corrections require a NEW entry, not a mutation.
- **Symptom:** Operator runs a scoring algorithm, sees an obvious bug in the produced score (e.g. demand category misread), tries to "fix" it by editing the prior `ScoreEntry`. There is no `PATCH /api/products/:productId/scores/:scoreId` route; attempts to mutate in-place either fail or, worse, corrupt the audit trail downstream review packets depend on.
- **Why it happens:** Per MJB primitive 92, month-over-month decision-state diffs MUST be replayable from history. Primitive 21 implies long-term shape evolution of the scoring algorithm — the `ScoreEntry.version` field lets the UI render mixed-version histories. Mutating prior entries would break replay and corrupt the historical timeline. README and contract comments both spell this out: "Append-only — primitive 21 + 92 require the full history."
- **How to avoid:** Document operationally that scoring is append-only. Build the operator UI so the "edit" affordance is actually "append a corrective entry." `ScoreEntry.notes` is the field for explaining why the new entry overrides the prior.
- **How to recover:** Append a NEW `ScoreEntry` via `POST /api/products/:productId/score` with `scoredBy: 'manual'`, `scorer: <operator id>`, `notes: 'corrects scoreId <prior-uuid>: <explanation>'`. The `latestScore` denormalized accessor will point at the new entry; the old entry stays in history with its `notes` providing context for any replay tooling.

---

### 2. Brand-lane re-assignment requires explicit `product.lane.assigned` emit — otherwise downstream caches go stale

- **Title:** Re-assigning a lane via service-layer code without going through the event-emitting path leaves downstream caps posting to the wrong audience.
- **Symptom:** Operator moves a product from `lane_mjb_main` to `lane_mjb_secondary`. social-distribution continues to post to the main-lane connector-config bindings until restart. content-dashboard's per-lane operator queues still show the product under the old lane.
- **Why it happens:** Downstream caps cache the lane locally for performance: social-distribution's per-lane connector-config binding is a hot path; content-dashboard's per-lane filter is rebuilt on event, not polled. `product.lane.assigned` with `priorLane` set IS the invalidation signal — README spells out: "the `priorLane` field on the event is the invalidation hint." If the service layer skips the emit (e.g. a backfill script that updates the DB directly), the consumers never learn.
- **How to avoid:** Lane writes MUST go through `POST /api/products/:productId/lane`, never direct SQL. The endpoint is the only place that's guaranteed to emit `product.lane.assigned` with the prior lane. Backfill / migration scripts must explicitly re-emit per affected row.
- **How to recover:** If you've discovered a missed emit, you can synthesize it: `POST /api/products/:productId/lane` with the current lane (a no-op write) is the cleanest way to force a `product.lane.assigned` (the endpoint should idempotent-emit). Alternatively, restart downstream consumers to force them to re-fetch.

---

### 3. Dedupe confidence band 0.6-0.9 is manual-review-required; auto-merge above 0.9

- **Title:** Mid-confidence dedupe routes to a human queue; under 0.6 = new product; over 0.9 = silent merge.
- **Symptom:** New ProductCandidate arrives; operator never sees it appear in either the active product list or the rejected list. Some time later it pops up in a content-dashboard "review needed" queue with action `'flagged-for-review'`.
- **Why it happens:** `POST /api/products/dedupe-check` returns one of three actions: `auto-merged` (≥0.9 — adds to existing `sources[]`, emits `product.duplicate.detected`), `flagged-for-review` (0.6-0.9 — routes to content-dashboard queue, NO product registered yet, NO rejection emitted yet), or `rejected` (decided no — but this is the path for `red-flag` / `manual-skip`, not duplicates). Per `ProductDuplicateDetectedSchema.action` enum and README's flow description.
- **How to avoid:** Operators must drain the review queue regularly. Document the band thresholds in the operator runbook. If the queue piles up, distribution is silently bottlenecked. Tune the thresholds only with strong analysis — moving the auto-merge floor below 0.9 risks false-merging genuinely different products.
- **How to recover:** Drain the queue. If false-merges happened (auto-merge fired on actually-different products), use `POST /api/products/consolidate` semantics in reverse — there is no native "un-merge" because consolidation is destructive (see edge 7). Recovery is to register a new Product from the mistakenly-merged candidate's stored data and manually break the link.

---

### 4. `metadata: Record<string, unknown>` is the registry's untyped junk drawer waiting to happen

- **Title:** Schema-free extension point — every downstream cap will stash things here, none of them coordinated.
- **Symptom:** A `jq '[.items[].metadata | keys] | add | unique'` over all products returns 30+ keys, half undocumented; new code can't predict the shape; a typo in one cap's metadata write isn't caught by validation.
- **Why it happens:** `ProductSchema.metadata` is `z.record(z.unknown()).default({})` — intentionally a free dict. README acknowledges this: "Document expected keys in `docs/metadata-keys.md` when patterns emerge; until then, expect ad-hoc additions by downstream caps (funnel-builder may stash funnel slug, etc.)." Without discipline, the field becomes a swamp.
- **How to avoid:** Maintain `docs/metadata-keys.md` (currently TODO per README build-status checklist) as keys emerge. Code review any cap that adds a new key. When a key is used by ≥2 consumers, consider promoting it to a typed Product field (breaking change — see edge 5).
- **How to recover:** Audit existing usage (`jq '[.items[].metadata | keys] | add | group_by(.) | map({key: .[0], count: length}) | sort_by(.count) | reverse'`). Decide for each key: document, promote, or remove. Coordinate removals carefully — a cap may silently rely on a key it never wrote.

---

### 5. `schemaVersion` bumps are breaking — all consumers must handle multiple versions during rollout

- **Title:** Any non-additive field change forces every downstream cap to learn the new version.
- **Symptom:** Mid-rollout, half the consumers receive v1-shaped events and half v2. A v1 consumer parsing a v2 payload fails zod validation (new required field, renamed field, tightened regex) and drops the event. Inconsistent state across consumers.
- **Why it happens:** `ProductSchema.schemaVersion` exists precisely because the contract is read by ~40 capabilities and primitive 92 needs old shapes replayable. Per README and contract comments: "BREAKING-CHANGE RULE: any field add/remove/retype here must bump `schemaVersion`. Migrations live in the service layer; old shapes must remain replayable for primitive 92's monthly diffs." Adding a new optional field is non-breaking; changing types, removing fields, tightening regexes IS breaking.
- **How to avoid:** Coordinate schemaVersion bumps as a multi-step deploy: (1) update contracts + bump version + emit BOTH old + new shape during transition, (2) deploy consumers updated to accept new shape, (3) flip emitters to new-only, (4) drop old-shape emit. Never bump and deploy in one shot.
- **How to recover:** The `dedupe-scan` job re-emits `product.registered` shaped to the current `schemaVersion` on demand so consumers can re-hydrate. Use this as the cleanup pass after a botched rollout. Pin each consumer cap's expected version range and surface mismatches as alerts, not silent drops.

---

### 6. `cluster.assignedAt` is the time of CLUSTERING, not product registration

- **Title:** Vectorize is async; products can cluster late.
- **Symptom:** Operator runs an analysis "how many products did we register vs. cluster in June?" and finds the cluster count is lower than the register count for the period, or sees products with `createdAt: 2026-06-01` and `cluster.assignedAt: 2026-06-15`.
- **Why it happens:** `ProductClusterSchema.assignedAt` is the timestamp of the vectorize cluster-assignment pass, NOT registration. Vectorize is L4 — it runs after embedding, which runs after registration, with whatever lag the cluster-assignment job has. README mentions cluster membership is re-evaluated by dedupe-scan and overwritten when confidence improves, so a product can be re-clustered multiple times after initial registration.
- **How to avoid:** Don't use `cluster.assignedAt` as a proxy for product age. Use `createdAt` for "when did the product enter the registry" and `cluster.assignedAt` only for "when was THIS cluster assignment made."
- **How to recover:** If analysis was built on the wrong assumption, rewrite to use `createdAt`. If cluster lag is consistently > 24h, escalate to vectorize team — that's an SLA conversation, not a registry bug.

---

### 7. Consolidation is destructive to merged ids — they're archived not deleted; re-registration hits the archive

- **Title:** Consolidation flips losers to `lifecycleState='consolidated'`; downstream references to those ids now point at tombstones.
- **Symptom:** A social post tagged with the loser's productId resolves to a `consolidated` product when the consumer fetches; or the consumer 404s if back-resolution isn't implemented. Re-registration of the same source candidate (e.g. product-intelligence re-scanned and emitted the same Amazon listing) hits the archive instead of creating a new product.
- **Why it happens:** Per `ConsolidationEntrySchema` and README: "Merging products via `POST /api/products/consolidate` flips the losers to `lifecycleState='consolidated'` and writes a `ConsolidationEntry` to the survivor — but downstream caps that hold productId references (a posted TikTok video tagged with the loser's id) now point at a tombstone. The service layer must back-resolve consolidated ids to surviving ids on every `GET /api/products/:productId`." Re-registration scenarios collide with the archive because the loser's `sources[]` entries are still in storage.
- **How to avoid:** Back-resolve consolidated → surviving on every `GET /api/products/:productId` AND every event consumer that holds a productId reference. Document that productIds are not safe to hold long-term across consolidation events.
- **How to recover:** If a downstream cap broke on a 404 for a consolidated id, the fix is to back-resolve at the cap's read site. If re-registration hit the archive surprisingly, examine the dedupe-check logic — it should match the survivor's `sources[]` entry and return `auto-merged` rather than treating the archive entry as "this candidate was rejected."

---

### 8. Forward-looking dep: bulk-media-import will route through registry for cloud-storage flows

- **Title:** `cloud-storage` uses `bulk-media-import` per the wiring graph; future `cloud-storage → registry` calls go through that path. Registry must not break those flows.
- **Symptom:** A `cloud-storage` operation that syncs product media expects to reach `product-registry` via `bulk-media-import` (which today is CLI-only — see wiring-graph hazards). When bulk-media-import gains an API surface, registry calls will start arriving via that path with shapes the registry hasn't seen before.
- **Why it happens:** `knowledge/decisions/wiring-graph.md` explicitly flags: "cloud-storage depends on bulk-media-import for sync runs — but bulk-media-import is currently a CLI-only capability (no api, no server runtime). Forward-looking; bulk-media-import will need an API surface." The registry's contract surface must remain stable enough that future media-import flows can call `POST /api/products/:productId/supplier-link` or `POST /api/products/:productId/media-ref-add` (latter not yet in route list) without forcing a registry rewrite.
- **How to avoid:** When designing the registry's media-related routes, allow for batch-shaped calls (`POST /api/products/media-refs:batch-add`) even if the initial v1 only handles singletons. This way the API contract doesn't need to change when bulk-media-import begins driving it.
- **How to recover:** When the forward-looking dep materializes, treat it as a coordinated deploy: agree on the new route's contract with bulk-media-import authors, version-tag if needed, and bump `schemaVersion` if any Product field shape shifts as a result.

---

### 9. Lifecycle state vs. decision state are deliberately separate — confusing them breaks analyses

- **Title:** `lifecycleState='live'` and `decisionState='KILL'` can coexist; treating them as the same field will produce nonsense.
- **Symptom:** An analysis that asks "how many products are currently live?" filters `lifecycleState='live'` and gets a number that includes products operationally killed. Or the inverse: filters `decisionState='SCALE'` and includes archived products that haven't been state-cleared.
- **Why it happens:** Per contract comments: lifecycleState tracks "what the registry has done with the product irrespective of any business decision"; decisionState tracks "what the SCORING and PERFORMANCE feedback loops mutate." The registry can know a product is live (lifecycle) while the business has decided to KILL it (decision); the killed-but-still-live state exists precisely so existing distribution can be wound down without flipping lifecycleState immediately.
- **How to avoid:** Always check BOTH fields when answering operational questions. "Active for distribution" = `lifecycleState IN ('live', 'enriched', 'scored') AND decisionState IN ('TEST','BUILD','SCALE','RETEST') AND archivedAt IS NULL`.
- **How to recover:** Re-run any analyses that used a single-field filter with the dual-field filter. Document the canonical "active" predicate somewhere shared (this folder is the right place).

---

### 10. Operator-promoted decision state can lose history if not appended as a ScoreEntry

- **Title:** Direct `PATCH /api/products/:productId` to change decisionState bypasses the score-history audit trail.
- **Symptom:** An operator promotes a product from TEST to BUILD via direct PATCH (without going through `POST /api/products/:productId/score`). Primitive 92's monthly diff reconstruction misses the transition — it sees BUILD in this month's snapshot but no ScoreEntry that explains when/why.
- **Why it happens:** `Product.decisionState` is writable via PATCH (per the route list). But the design intent is that decision-state transitions land in `scoreHistory[]` with `ScoreEntry.decisionStateAfter` set, because primitive 92 reconstructs history from there. Allowing decisionState mutation without a corresponding score-history append is convenient but breaks the audit primitive.
- **How to avoid:** Service layer should reject `PATCH` that changes `decisionState` and require operators to use `POST /api/products/:productId/score` with `scoredBy: 'manual'` (the `decisionStateAfter` field on ScoreEntry will then sync up the parent's `decisionState`). Even an operator-only promotion deserves a score entry with notes explaining the rationale.
- **How to recover:** If silent transitions have occurred, append back-dated `ScoreEntry` rows with `scoredBy: 'manual'`, `notes: 'back-filled to capture undocumented transition on <date>'`. The replay tooling won't be perfectly accurate but will be reconstructible.
