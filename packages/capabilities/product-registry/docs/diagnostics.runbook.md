# product-registry · diagnostics.runbook.md

Operational runbook for the `product-registry` capability. Covers env, expected I/O, common failures with diagnostic commands, retry policy, budget interaction, and escalation thresholds.

> Status: `planned` — contracts-only scaffold. Service code, persistence adapter, and dedupe-check implementation are follow-ups (see `README.md` build-status checklist). Diagnostic commands target the service port `5302` declared in `manifest.yaml runtime.backend.ports`.

---

## 1. Purpose

L1 canonical product spine: receives `ProductCandidate` from `product-intelligence`, runs dedupe-check, assigns stable `prod_*` ids, owns lifecycle state, append-only score history, brand-lane assignment, red-flags, creative-winners, consolidation audit, and supplier links — the entity ~40 of the 102 MJB primitives depend on.

---

## 2. Required env vars

From `manifest.yaml requires.env[]`:

| Name | Format | Source |
|---|---|---|
| `DATABASE_URL` | SQL connection string. Per registry conventions: D1 binding URL (`d1://<account>/<db>`) or local sqlite path (`file:./data/registry.db`) or postgres URL (`postgres://user:pass@host:5432/dbname`). | Operator deployment. D1: Cloudflare dashboard → Workers → D1 → bindings. Local dev: `file:./data/registry.db` is the default. |

Implicit / conventional env vars:

| Name | Format | Source |
|---|---|---|
| `INTAKE_PIPELINE_URL` | http URL | Per `requires.capabilities: [intake-pipeline]` dep; the registry resolves `ProductMediaRef.intakeObjectId` against this service to surface presigned URLs. |
| `COST_LEDGER_URL` | http URL | Per `requires.capabilities: [cost-ledger]` dep; the registry pre-flights `GET /api/cost/rollup` before expensive operations and may emit `cost.recorded` for storage costs. |
| `VECTORIZE_URL` *(if vectorize integration is in process)* | http URL | Cluster assignment via `product.cluster.assigned` consumes vectorize output; the integration is currently inferred (vectorize is an L4 cap), not directly env-declared. |

n/a-justifications:

- `manifest.yaml security.secrets[]: []` — the registry holds no upstream credentials of its own; its only "secret" is the database connection string which the deployment layer handles.

---

## 3. Expected inputs

### Bus events consumed (registry as subscriber)

| Event | Producer | Schema | Why |
|---|---|---|---|
| `product.candidate.discovered` | product-intelligence | `ProductCandidateDiscoveredEvent` (`packages/capabilities/product-intelligence/contracts/events.ts`) | Triggers dedupe-check; on accept, the registry calls its own `POST /api/products` and emits `product.registered`. |
| `product.candidate.enriched` | product-intelligence | `ProductCandidateEnrichedEvent` | Merges the patch into the existing Product matched via `Product.sources[].candidateId`, flips `lifecycleState='enriched'`, emits `product.updated`. |
| `supplier.candidate.found` | product-intelligence | `SupplierCandidateFoundEvent` | Surfaces to the operator review queue; on accept, calls `POST /api/products/:productId/supplier-link`. |
| `cost.recorded` *(implicit downstream of cost-ledger)* | cost-ledger | `CostRecordedSchema` | Registry may subscribe to per-product spend for `Product.metadata.totalCostUsd` denormalization (forward-looking — not in current contracts). |

### HTTP API surfaces (from `manifest.yaml provides.api[]`)

| Route | Body / Query | Schema cited |
|---|---|---|
| `POST /api/products` | `ProductSchema` minus computed fields (id, createdAt, updatedAt, schemaVersion). Registry assigns id + timestamps. | `ProductSchema` (`contracts/product.ts`) |
| `GET /api/products` | Query: `?lane=<BrandLane>&decisionState=<DecisionState>&lifecycleState=<LifecycleState>&limit=<n>&cursor=<id>` | Returns `{ items: Product[], nextCursor?: string }`. |
| `GET /api/products/:productId` | n/a | Returns `ProductSchema`. Resolves consolidated-to-survivor (sharp-edges edge 7). |
| `PATCH /api/products/:productId` | `Partial<ProductSchema>` (typed via `ProductSchema.partial()`) | Returns updated `ProductSchema`; emits `product.updated`. |
| `POST /api/products/:productId/lane` | `{ brandLane: BrandLane, assignedBy: 'auto' \| 'operator' }` | `BrandLaneSchema` |
| `POST /api/products/:productId/score` | `ScoreEntrySchema` minus computed fields (scoreId is registry-assigned). | `ScoreEntrySchema` |
| `GET /api/products/:productId/scores` | n/a | Returns `ScoreEntry[]` (the full append-only history). |
| `POST /api/products/:productId/archive` | `{ reason: string }` | Emits `product.archived`; sets `lifecycleState='archived'`. |
| `POST /api/products/consolidate` | `{ survivingProductId, mergedFromProductIds: [], reason }` | `ConsolidationEntrySchema` |
| `POST /api/products/:productId/supplier-link` | `SupplierLinkSchema` | `SupplierLinkSchema` |
| `GET /api/products/:productId/history` | Query: `?since=<iso>` | Returns chronological event log for the product (`product.registered`, `product.updated`, lane changes, scores, supplier links). |
| `POST /api/products/dedupe-check` | `{ name, mediaHashes?: string[], clusterId?: string, source, sourceId }` | Returns `{ action: 'auto-merged' \| 'flagged-for-review' \| 'rejected' \| 'new', existingProductId?, dedupeScore }`. |

---

## 4. Expected outputs

### Bus events emitted (from `manifest.yaml provides.events[]`)

| Event | Schema | When |
|---|---|---|
| `product.registered` | `ProductRegisteredSchema` | After successful `POST /api/products` (dedupe passed). Payload includes the full Product and `source: 'auto-from-candidate' \| 'manual'`. |
| `product.updated` | `ProductUpdatedSchema` | After `PATCH /api/products/:productId` or merge of an enrichment patch. Carries `changed[]` + `updatedFields` diff (consumers re-fetch the full Product if needed). |
| `product.lane.assigned` | `ProductLaneAssignedSchema` | After `POST /api/products/:productId/lane`. Includes `priorLane` on re-assignment for downstream cache invalidation. |
| `product.score-history.appended` | `ProductScoreHistoryAppendedSchema` | After `POST /api/products/:productId/score`. Includes `replacedDecisionState` if the parent's decisionState changed. |
| `product.archived` | `ProductArchivedSchema` | After `POST /api/products/:productId/archive`. |
| `product.consolidated` | `ProductConsolidatedSchema` | After `POST /api/products/consolidate`. |
| `product.duplicate.detected` | `ProductDuplicateDetectedSchema` | After `POST /api/products/dedupe-check` returns `action: 'auto-merged' \| 'flagged-for-review' \| 'rejected'`. |
| `product.cluster.assigned` | `ProductClusterAssignedSchema` | When vectorize integration assigns / re-assigns cluster id. `source: 'vectorize'` (literal). |
| `product.creative-winner.recorded` | `ProductCreativeWinnerRecordedSchema` | After `performance-loop` writes a CreativeWinner (registry exposes a write path though not listed as a top-level route — likely a sub-resource of PATCH). |
| `product.candidate.rejected` | `ProductCandidateRejectedSchema` | When dedupe-check rejects (`reason: 'duplicate'`) or red-flag-blocker fires (`reason: 'red-flag'`) or score is below band (`reason: 'below-band'`) or operator rejects from review queue (`reason: 'manual-skip'`). |
| `supplier.linked` | `SupplierLinkedSchema` | After `POST /api/products/:productId/supplier-link`. |
| `supplier.unlinked` | `SupplierUnlinkedSchema` | After `DELETE` (not in the route list — implied by symmetry) of a supplier link. |

---

## 5. Common failures

| Symptom | Likely cause | Diagnostic command | Recovery action |
|---|---|---|---|
| `db-reachable` healthcheck fails (`GET /api/products?limit=1` returns 500 / connection refused) | `DATABASE_URL` unset, wrong, or persistent store unreachable. | `curl -fs http://127.0.0.1:5302/api/products?limit=1` and inspect the cap's logs for connection errors; verify `DATABASE_URL` is set. | Fix `DATABASE_URL`, ensure the store (D1, sqlite file, postgres) is reachable; for sqlite verify file permissions; restart the cap. |
| `schema-current` healthcheck fails | `GET /api/registry/schema-version` returns a value not matching `registry.schemaVersion` from the root catalog. Migration was deployed without bumping the catalog, or rollback left mismatched. | `curl -s http://127.0.0.1:5302/api/registry/schema-version` and compare to `grep -A2 product-registry C:/Code/CODE_MODULE_LIBRARY/registry.yaml \| grep schemaVersion`. | Either roll the schema (run migrations) or roll the registry.yaml entry — never let them diverge in production. |
| `product.candidate.discovered` events arrive but no `product.registered` is emitted | Subscriber not wired, dedupe-check rejecting everything as `duplicate`, or upstream emits malformed payloads that fail zod parse. | `curl -s http://127.0.0.1:5302/api/products?limit=5` to see whether anything is registered. Tail the bus log and grep `product.candidate.rejected`. | If rejection rate is 100% with `reason='duplicate'`, dedupe threshold may be too aggressive. If subscriber is silent, restart cap and verify event-bus subscriptions. |
| Operator says "this product was registered yesterday but doesn't appear" | Consolidated into another product (sharp-edges edge 7). The id is now archived as the loser of a merge. | `curl -s http://127.0.0.1:5302/api/products/prod_old_id123` — the service should auto-resolve to the survivor; if it 404s, back-resolve is missing. | If 404: query `GET /api/products/:productId/history` on candidate survivors or scan the consolidation audit table directly. Patch service to back-resolve. |
| Lane re-assigned but downstream caps still posting to old lane | `product.lane.assigned` not emitted on re-assign, OR downstream cap not subscribed (sharp-edges edge 2). | `grep product.lane.assigned <bus log> \| jq 'select(.productId=="prod_abc123def456")'` | Manually emit a `product.lane.assigned` if missing (via a patched re-assign), and verify downstream caps (social-distribution, content-dashboard) have handlers. |
| Scoring entry was wrong — operator wants to "fix" it | Score history is append-only (sharp-edges edge 1) — no edit, no delete. | `curl -s http://127.0.0.1:5302/api/products/prod_abc123def456/scores \| jq '.[-3:]'` to see recent scores. | Append a NEW `ScoreEntry` via `POST /api/products/:productId/score` with `scoredBy: 'manual'`, `notes: 'corrects scoreId <uuid>: <explanation>'`. Do NOT mutate the prior entry. |
| Two products were operator-merged but downstream cap (e.g. content-dashboard) still shows two | `POST /api/products/consolidate` succeeded but `product.consolidated` event consumer is missing or stale. | `grep product.consolidated <bus log> \| jq 'select(.survivingProductId=="prod_abc123def456")'` then check content-dashboard logs for handler invocation. | Restart content-dashboard subscription; verify it processes the `mergedFromProductIds[]` list to invalidate its caches. |
| `Product.metadata` field has grown unbounded; new code can't predict its shape | The schema-free extension point became the junk drawer (sharp-edges edge 4). | `curl -s http://127.0.0.1:5302/api/products?limit=100 \| jq '[.items[].metadata \| keys] \| add \| unique'` to see all keys currently in use. | Document discovered keys in `docs/metadata-keys.md` (TODO per README build-status); consider promoting frequently-used keys to typed Product fields (which is a schemaVersion bump — sharp-edges edge 5). |
| `intake-pipeline` down — `ProductMediaRef.intakeObjectId` cannot resolve to presigned URLs | Hard dep on `requires.capabilities: [intake-pipeline]`. | `curl -fs $INTAKE_PIPELINE_URL/api/health` | Restore intake-pipeline; registry CRUD continues to work (media refs are stored as opaque ids) but media display is degraded. |
| `cluster.assignedAt` is later than `createdAt` by hours / days | Vectorize is async — sharp-edges edge 6. Cluster is assigned post-registration when vectorize gets around to it. | `curl -s http://127.0.0.1:5302/api/products/prod_abc123def456 \| jq '{createdAt, cluster: .cluster}'` | Expected behavior. If clusters never appear, check vectorize health and the `product.cluster.assigned` consumer wiring. |
| Dedupe band 0.6-0.9 candidate piling up unreviewed | Manual-review queue (sharp-edges edge 3) routes to content-dashboard; operator hasn't drained. | `curl -s "http://127.0.0.1:5302/api/products?lifecycleState=draft" \| jq '.items \| length'` (review-pending may surface here, depending on implementation) | Operator must process the review queue; high pile-up indicates either dedupe band needs adjustment or operator capacity is the bottleneck. |
| `cost.budget.exceeded` for `scope: 'capability', scopeId: 'product-registry'` fires | Registry is doing more work than the budget allows — likely repeated re-registration of the same source candidates hitting the archive (sharp-edges edge 8). | `curl -s "$COST_LEDGER_URL/api/cost/rollup?scope=capability&scopeId=product-registry"` | Reduce re-registration rate by caching dedupe-check results upstream; if budget is too tight, raise it via `POST /api/cost/budget`. |
| `schemaVersion` rollout — half of consumers on v1, half on v2 | Breaking field changes are not gracefully handled by stale consumers (sharp-edges edge 5). | `curl -s http://127.0.0.1:5302/api/products/prod_abc123def456 \| jq '.schemaVersion'` | Pin every consumer cap to a known schemaVersion range; coordinate a deploy across consumers before bumping; the dedupe-scan job can re-emit `product.registered` shaped to current schemaVersion on demand for re-hydration. |

---

## 6. Retry policy

| Job / handler | Retry behavior | Hard-stop trigger |
|---|---|---|
| `product-registry:dedupe-scan` | Periodic batch job (frequency configured by scheduler). On failure of a single product's dedupe-check, log and continue. Whole-job failure (e.g. DB down) → next scheduled run picks up. | DB unavailable across multiple consecutive runs → emit `notify` alert. |
| `product-registry:rollup-decision-state` | Same — periodic; per-product failures logged, job continues. | n/a |
| `product-registry:archive-stale` | Periodic. Stale = `lifecycleState='paused' AND updatedAt < now - <thresholdDays>`. Per-product archive failures logged. | n/a |
| Subscriber on `product.candidate.discovered` | On dedupe-check failure (DB error), event is logged for manual replay; not auto-retried (avoid infinite loop on persistent DB outage). | n/a |
| `POST /api/products` ingest | None at HTTP layer — 5xx returns immediately; 4xx is the caller's bug. | n/a |
| Vectorize cluster assignment consumer | If vectorize result references a productId that doesn't exist (race: vectorize processed faster than registry), log and skip; vectorize will re-emit on next pass. | n/a |

---

## 7. Budget behavior

product-registry's primary cost surfaces are:

- **Persistence writes** (DB ops are not typically per-write metered; registry doesn't emit `cost.recorded` for normal CRUD).
- **Vectorize integration** when registry triggers re-cluster (vectorize may bill per embedding).
- **Bulk import or seed loads** (large `POST /api/products` batches).

Registry's interaction with cost-ledger:

- **Subscribe to `cost.budget.exceeded`** with `scope: 'capability', scopeId: 'product-registry'`. On exceed: throttle non-urgent jobs (`dedupe-scan`, `rollup-decision-state`) to next period; keep handling user-facing CRUD (degrade jobs before degrading API).
- **Per-product budget resolution**: when `cost.recorded` events come in carrying `ref=<productId>`, registry can resolve the productId → `Product.brandLane` to support cost-ledger's `scope: 'brand-lane'` evaluation. This is the inverse of cost-ledger sharp-edges edge 8 — registry IS the resolver for that scope.
- **No native budget enforcement** for registry's own work — the registry is L1, declares cost-ledger as a hard dep, but does not refuse writes on budget grounds. Refusing user-facing writes risks data loss; degrading background jobs is preferred.

---

## 8. Diagnostic commands

Health checks from `manifest.yaml diagnostics.healthChecks[]`:

```bash
# 1. DB reachable (the manifest's db-reachable check)
curl -fs http://127.0.0.1:5302/api/products?limit=1 && echo OK || echo BAD

# 2. Schema-current (the manifest's schema-current check)
SVC=$(curl -s http://127.0.0.1:5302/api/registry/schema-version | jq -r '.schemaVersion')
REG=$(grep -A4 'id: product-registry' C:/Code/CODE_MODULE_LIBRARY/registry.yaml | grep schemaVersion | awk '{print $2}')
[ "$SVC" = "$REG" ] && echo OK || echo "MISMATCH svc=$SVC reg=$REG"
```

State / behavior probes:

```bash
# 3. Quick sanity browse
curl -s 'http://127.0.0.1:5302/api/products?limit=5' | jq '.items | map({id, name, decisionState, lifecycleState, brandLane})'

# 4. Pull one product
curl -s http://127.0.0.1:5302/api/products/prod_abc123def456 | jq .

# 5. Pull score history
curl -s http://127.0.0.1:5302/api/products/prod_abc123def456/scores | jq 'length, last'

# 6. Filter by lane + decision state
curl -s 'http://127.0.0.1:5302/api/products?lane=lane_mjb_main&decisionState=TEST&limit=50' | jq '.items | length'

# 7. Get full event history for a product
curl -s 'http://127.0.0.1:5302/api/products/prod_abc123def456/history' | jq 'length'

# 8. Run a manual dedupe check (probe without registering)
curl -s -X POST http://127.0.0.1:5302/api/products/dedupe-check \
  -H 'content-type: application/json' \
  -d '{"name":"USB-C Magnetic Phone Mount","source":"amazon","sourceId":"B0CXAMPLE","mediaHashes":["sha256:abc..."],"clusterId":"clust_42"}'

# 9. Manually assign a lane (e.g. after operator review)
curl -i -X POST http://127.0.0.1:5302/api/products/prod_abc123def456/lane \
  -H 'content-type: application/json' \
  -d '{"brandLane":"lane_mjb_main","assignedBy":"operator"}'

# 10. Append a manual score (with corrective notes — sharp-edges edge 1)
curl -i -X POST http://127.0.0.1:5302/api/products/prod_abc123def456/score \
  -H 'content-type: application/json' \
  -d '{"scoredBy":"manual","scorer":"ops:jalen","version":"v1","categories":{"demand":4,"margin":3,"supplier-confidence":4,"differentiation":3,"shipping-risk":2,"creative-potential":4,"saturation":3,"buyer-evidence":4},"totalScore":27,"band":"27-33","decisionStateAfter":"TEST","notes":"corrects scoreId 9f8e..."}'

# 11. Archive a product
curl -i -X POST http://127.0.0.1:5302/api/products/prod_abc123def456/archive \
  -H 'content-type: application/json' \
  -d '{"reason":"supplier outage, paused indefinitely"}'

# 12. Consolidate (merge) products
curl -i -X POST http://127.0.0.1:5302/api/products/consolidate \
  -H 'content-type: application/json' \
  -d '{"survivingProductId":"prod_abc123def456","mergedFromProductIds":["prod_old1xxxxxxx","prod_old2xxxxxxx"],"reason":"identical product, multi-source discovery before dedupe-scan caught it"}'

# 13. Tail bus events emitted by this cap
tail -F "$DATA_DIR/bus.jsonl" | jq -c 'select(.event | startswith("product.") or startswith("supplier."))'

# 14. Snapshot of consolidation activity in last 24h
grep product.consolidated "$DATA_DIR/bus.jsonl" 2>/dev/null | \
  jq -c 'select(.consolidationEntry.consolidatedAt >= "'"$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)"'")' | \
  jq -s 'length'
```

---

## 9. Escalation

Escalate to human operator when:

| Signal | Why |
|---|---|
| Dedupe band 0.6-0.9 queue grows past operator's drain rate for >24h | Manual-review queue (sharp-edges edge 3) is the operator gate; back-pressure means new candidates pile up. Operator throughput is the constraint; possibly the band needs adjustment. |
| Any `product.lane.assigned` re-assignment occurs without `priorLane` populated | Sharp-edges edge 2 — downstream caps that cached the prior lane have no signal to invalidate. Audit the emitter; this is a contract violation. |
| `schemaVersion` mismatch (healthcheck `schema-current` fails) | Catalog and runtime drift means consumers don't know which contract version they're receiving. Block deploys until resolved. |
| Consolidation merges a product that is referenced by active social-distribution posts | The post-side reference still exists but now points at a `consolidated` lifecycleState. social-distribution may post against the old id; back-resolution must be working end-to-end. Operator audit needed. |
| A red-flag with `severity='blocker'` is raised on a product currently in `decisionState='SCALE'` | Money is flowing on a product that should be SKIP. Per primitive 84, blocker flags force SKIP — but if the product is already at SCALE the operator must decide whether to immediately pause distribution. |
| `Product.metadata` contains keys that include suspicious data (credentials, full PII, large blobs) | Sharp-edges edge 4 — the extension point grew unbounded. Operator audit + sanitization. |
| `cluster.assignedAt` consistently lags `createdAt` by > 24h | Vectorize is unreachable or backed up; cluster-based dedupe (which feeds `POST /api/products/dedupe-check`) is degraded. |
| Brand-lane assignment delayed (products sitting `brandLane=undefined` >48h) | Per MJB primitive 79, products without lane CANNOT be published. Operator queue is the constraint; if blocked, distribution is silently stalled. |
