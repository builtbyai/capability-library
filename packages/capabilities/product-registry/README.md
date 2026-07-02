# product-registry

L1 MJB capability. The **canonical product JSON spine** for the entire MJB commerce pipeline. ~40 of the 102 MJB primitives consume the `Product` shape declared in `contracts/product.ts`; every L1+ MJB capability reads from or writes into this registry rather than inventing its own product object.

Status: `planned` (contracts-only scaffold). No service code yet.

## What it is

A capability that owns one job: assign and maintain the canonical `Product` entity. It receives `ProductCandidate` rows from `product-intelligence`, runs a dedupe check, assigns a stable `prod_*` id, and layers on lifecycle state, append-only score history, brand-lane assignment, red-flags, creative-winners, consolidation audit, and supplier links. Everything else in the MJB stack (`product-scoring`, `ugc-concept-engine`, `funnel-builder`, `social-distribution`, `performance-loop`, `content-dashboard`) reads from this registry through the `GET /api/products/:productId` surface or via subscribing to `product.*` bus events.

## Why this is a separate capability from `intake-pipeline`

`intake-pipeline` is the universal byte store — it holds files, blobs, scraped HTML, generated assets, and emits `intake.object.stored` when something lands. It is intentionally schema-thin: every IntakeObject looks the same. `product-registry` is the opposite — it owns a strongly-typed, schema-versioned commerce entity with lifecycle, decision-state, scoring history, and a brand-lane firewall. The two compose: a `Product.mediaRefs[]` entry points at an `intakeObjectId`, but the structured `Product` row lives in this capability's domain.

## Why this is a separate capability from `knowledge-index`

`knowledge-index` is vector RAG over **chunks** — semantic retrieval, embeddings, citation. `product-registry` is structured CRUD over **Product entities** — typed fields, foreign keys (sources, suppliers, cluster), append-only history. The two cross-reference (the `vectorize` cluster id from primitive 45 lands on `Product.cluster.clusterId`, and `knowledge-index` may RAG-search product descriptions), but they are not collapsible. A RAG store has no notion of "this product's decisionState is currently TEST"; the registry has no notion of "documents semantically near this query".

## The `Product` vs `ProductCandidate` distinction

| Aspect | `ProductCandidate` (product-intelligence) | `Product` (product-registry) |
|---|---|---|
| Origin | Raw signal from one source family adapter | Registered, lifecycle-stateful entity |
| Id shape | `uuid` (per-discovery) | `prod_*` 12-char (stable, owned) |
| Source attribution | Single source / sourceId pair | `sources[]` — many candidates can roll up to one product |
| Mutability | Immutable snapshot + `rawSnapshot` | Mutable — scoreHistory appends, lane re-assigns, suppliers link/unlink |
| Lifecycle | n/a — exists as an event payload | `lifecycleState` + `decisionState` machines |
| Schema versioning | Tied to adapter version | `schemaVersion` field; breaking changes require bump |

A `ProductCandidate` that loses the dedupe check never becomes a `Product` — it emits `product.candidate.rejected` with `reason='duplicate'` and the existing product gains a new entry in its `sources[]`.

## Lifecycle states (`LifecycleStateSchema`)

| State | Trigger |
|---|---|
| `draft` | Operator-entered row that has not yet been validated; auto-created products skip this. |
| `registered` | Default after `POST /api/products` succeeds (dedupe passed, id issued). |
| `enriched` | A follow-up `product.candidate.enriched` event from product-intelligence landed (supplier hint, review summary, etc.). |
| `scored` | At least one `ScoreEntry` is in `scoreHistory`. |
| `live` | A funnel has been published and/or a post has been scheduled against this product. |
| `paused` | Temporarily withdrawn from automation paths (e.g. supplier outage). Reversible. |
| `archived` | Withdrawn from active queues (terminal unless un-archived). |
| `consolidated` | Merged into a surviving product via `POST /api/products/consolidate`. Terminal. |

## Decision states (`DecisionStateSchema`)

| State | Written by |
|---|---|
| `SKIP` | `product-scoring` (band 8-18 OR red-flag blocker raised) |
| `WATCH` | `product-scoring` (band 19-26) |
| `TEST` | `product-scoring` (band 27-33) |
| `BUILD` | `product-scoring` (band 34-40) OR operator promotion from TEST |
| `SCALE` | Operator (with perf-evidence bundle from `performance-loop`) |
| `KILL` | `performance-loop` (monthly roll-up) OR operator |
| `RETEST` | `performance-loop` OR operator (re-enter the TEST loop after a creative change) |
| `ARCHIVED` | This capability (`POST /api/products/:productId/archive`) |

Per MJB primitive 92, the **history** of decision-state transitions matters — each `ScoreEntry` records the `decisionStateAfter` at the moment it ran so monthly diffs can be reconstructed without a separate audit log.

## Score history is append-only

`Product.scoreHistory[]` is **never overwritten**. Every score run by `product-scoring` (auto) or operator (manual) appends one `ScoreEntry`. Primitive 92 requires month-over-month decision-state diffs to be replayable, and primitive 19 implies long-term shape evolution. The `latestScore` field is a denormalized convenience accessor; the service layer keeps it pointed at `scoreHistory[length - 1]`. When the scoring algorithm itself changes, the `ScoreEntry.version` field lets the UI render mixed-version histories without back-filling old entries.

## Brand-lane is the MJB firewall

Per MJB primitive 80, the `brandLane` field is what prevents private/professional audience bleed across brands. Lane assignment is a deliberate post-registration step (`POST /api/products/:productId/lane`) — products start with `brandLane=undefined` and stay there until an operator (or a lane-policy automation) assigns one. Downstream caps (`social-distribution`'s pre-flight checklist, primitive 79) MUST refuse to publish a product without a lane. Re-assignment emits `product.lane.assigned` with the prior lane in `priorLane` so consumers that cached the previous lane (per-lane connector-config bindings, per-lane content-dashboard filters) know to invalidate.

## How to consume from upstream

The canonical wiring from `product-intelligence` → `product-registry`:

1. `product-intelligence` emits `product.candidate.discovered` with a `ProductCandidate` payload.
2. A subscriber inside `product-registry` calls `POST /api/products/dedupe-check` with the candidate's name + media-hash + cluster id (if vectorize has classified it).
3. On `action='auto-merged'`, the existing Product gains a `sources[]` entry and the registry emits `product.duplicate.detected` + updates the existing product.
4. On `action='rejected'` (high-confidence dup), the registry emits `product.candidate.rejected` with `reason='duplicate'`.
5. On `action='flagged-for-review'` (0.6-0.9 confidence band), the candidate routes to a `content-dashboard` review queue; an operator approves or rejects.
6. Otherwise the registry calls `POST /api/products` to register, emits `product.registered`, and downstream subscribers (`product-scoring`, `vectorize`, etc.) take it from there.

## Sharp edges

- **Dedupe is hard.** Cluster ids from `vectorize` help but are not authoritative — two physically-different products in the same niche can have near-identical embeddings. The registry uses a layered match: exact source+sourceId pair → media-hash collision → cluster-id + name-similarity threshold. The 0.6-0.9 confidence band routes to a manual review queue; auto-merge only fires above 0.9.
- **Lane re-assignment must emit `product.lane.assigned`.** Otherwise downstream caps that cached the prior lane (social-distribution's per-lane connector-config binding, content-dashboard's per-lane operator queues) will continue posting to the wrong audience until they next refetch. The `priorLane` field on the event is the invalidation hint.
- **Score history is append-only, so schema migrations need to handle old shapes.** Bumping `Product.schemaVersion` covers new fields, but old `ScoreEntry.categories` keys cannot disappear without breaking primitive 92's monthly diffs. Migrations must coerce, not delete.
- **The `metadata: Record<string, unknown>` extension point can grow into chaos.** When downstream caps start stashing things there (funnel-builder's funnel slug, performance-loop's last-perf-snapshot id), document expected keys in a separate `docs/metadata-keys.md` so the field does not silently become the registry's untyped junk drawer.
- **Consolidation is destructive at the workflow layer.** Merging products via `POST /api/products/consolidate` flips the losers to `lifecycleState='consolidated'` and writes a `ConsolidationEntry` to the survivor — but downstream caps that hold productId references (a posted TikTok video tagged with the loser's id) now point at a tombstone. The service layer must back-resolve consolidated ids to surviving ids on every `GET /api/products/:productId`.
- **`schemaVersion` must be bumped on any breaking field change.** Adding a new optional field is non-breaking; changing a field's type, removing a field, or tightening a regex IS breaking. The dedupe-scan job re-emits `product.registered` shaped to the current schemaVersion on demand so listeners can re-hydrate without a global migration.

## MJB primitives served

Explicitly:

- **40** — Assign canonical product JSON id + write to product registry (`POST /api/products` + `product.registered`).
- **41** — Maintain prompt-recipe library: not owned by registry, but `Product.metadata.promptRecipeId` is the canonical join key.
- **45** — Cluster assignment from vectorize lands on `Product.cluster`.
- **79** — Block publication if brand-lane is unidentified (registry holds the lane; social-distribution enforces the gate).
- **80** — Block private/professional audience bleed across brand lanes (registry is the lane authority).
- **82** — Reject supplier match (registry stores the `suppliers[]` link; product-scoring writes the reject).
- **92** — Monthly promote/kill/consolidate (registry's append-only score history + consolidation surface).
- **100** — Track creative-winner notes per product (`Product.creativeWinners[]` + `product.creative-winner.recorded` event).

Implicitly (any primitive that references a "product" in its body resolves the term to the `Product` shape declared here).

## Downstream consumers

- **`product-scoring`** — writes `scoreHistory` entries via `POST /api/products/:productId/score`; reads `Product` for context.
- **`ugc-concept-engine`** — reads `Product` for hook/script/objection generation context (name, description, tagline, mediaRefs).
- **`funnel-builder`** — reads `Product` for page render (name, description, pricing, mediaRefs, brandLane).
- **`social-distribution`** — reads `Product.brandLane` for the pre-flight lane check (primitive 79); reads `mediaRefs` + `creativeWinners` to pick the asset to post.
- **`performance-loop`** — writes `creativeWinners` entries; subscribes to `product.score-history.appended` to detect decision-state transitions.
- **`content-dashboard`** — reads `Product` lists for operator queues (`GET /api/products?lane=...&decisionState=...`); subscribes to `product.duplicate.detected` (review queue) and `product.lane.assigned` (per-lane refresh).

## Build status checklist

- [x] `manifest.yaml`
- [x] `contracts/product.ts` (canonical `Product` + sub-shapes)
- [x] `contracts/events.ts` (all 12 events typed)
- [x] `contracts/index.ts` (barrel)
- [x] `README.md` (this file)
- [ ] `docs/diagnostics.runbook.md` (referenced from manifest; follow-up)
- [ ] `docs/sharp-edges.md` (per the capability standard; follow-up)
- [ ] `docs/metadata-keys.md` (when downstream caps start using `Product.metadata`)
- [ ] Service / router code (none yet — contracts-only scaffold)
- [ ] Persistence adapter (D1 / sqlite migration set)
- [ ] Dedupe-check implementation (vectorize integration + manual-review queue routing)
