# ugc-concept-engine

L2 MJB capability. Generates UGC concept assets (hooks, scripts, problem-to-solution angles, lifestyle vignettes, objection rebuttals, captions, storyboards) per Product, via an LLM call routed through `deepseek-router`. Every output passes the authenticity gate before persistence.

Status: `planned` (contracts-only scaffold). No service code yet.

## What it is

A capability that takes a `Product` (from `product-registry`) plus a target `brandLane` and emits one or more typed `Concept` rows (kind = `hook | script | angle | lifestyle | caption | storyboard`). Internally it bundles the Product context (name, description, tagline, mediaRefs, prior creative-winners), asks `deepseek-router` to generate, then runs the **5-question authenticity gate** before persisting. Rejected concepts emit `ugc.authenticity.rejected` and do not produce a `Concept` row.

The engine subscribes to `product.scored` (from `product-scoring`) and only generates concepts for products that landed in a launchable decision band (`TEST`, `BUILD`, `SCALE`) — concepts for `SKIP` / `KILL` / `ARCHIVED` products would burn LLM spend on something nobody is going to post.

## Why this is separate from `social-distribution`

`social-distribution` is the *scheduling and posting* layer — it picks an asset, attaches a Concept, runs pre-flight (brand-lane gate, link-health gate, asset-format gate), and pushes to a connector. `ugc-concept-engine` is the *generation* layer — it produces the creative artifact. Scheduling logic does not belong here; LLM prompting + the authenticity gate do not belong in the scheduler.

## The authenticity gate is the LAW (MJB primitive 64)

Every generated concept — and every operator-authored concept that enters via POST — MUST be evaluated against the 5-question checklist in `AuthenticityCheckSchema`:

| Q | Question | TRUE means... |
|---|---|---|
| q1 | Does it claim a fake testimonial? | "Sarah from Texas said..." with no real Sarah |
| q2 | Does it claim fake personal use without evidence? | "I bought this and..." when the creator hasn't |
| q3 | Does it make a medical / safety / financial claim? | "treats anxiety", "FDA-cleared", "guaranteed returns" |
| q4 | Does it cite unverifiable specificity? | "9 out of 10 doctors", "studies show" |
| q5 | Does it match the brand lane's tone / voice? | FALSE means it drifted off-lane |

Decision: **pass** iff `q1..q4` are all `false` AND `q5` is `true`. Any other combination = **reject**.

A `reject` emits `ugc.authenticity.rejected` carrying the candidate content + the `AuthenticityCheck` (so an operator can audit in the dashboard). It MUST NOT produce a `Concept` row. The service layer treats "persist a concept with `authenticityPassed=false`" as a contract violation.

The gate references **brand-lane policy** (each lane has its own voice rules) — the same content can pass for one lane and reject for another. The policy lives in `connector-config` / a per-lane policy file the gate loads at startup.

## How `cost-ledger` gates regeneration

Every LLM call (whether it ends up persisted or rejected by the gate) records a `cost.recorded` event against `cost-ledger`. The Concept row carries the `costRecordedRef` so the dashboard can render "this hook cost $0.0012 to generate". Per-product and per-brand-lane work allowances (MJB primitive 86) cap how much spend a single product can accumulate — when the budget is exceeded, `cost-ledger` emits `cost.budget.exceeded` and the engine refuses further regeneration requests until the operator raises the cap.

Dry-run authenticity checks (`POST /api/ugc/authenticity-check`) do NOT call the LLM and do NOT record cost.

## Hook families (MJB primitive 28)

| Family | Use when... |
|---|---|
| `problem-reveal` | The product is best framed as the answer to a named pain |
| `discovery` | The product is novel / "you didn't know this existed" |
| `comparison` | A clear, named alternative exists and the product wins |
| `before-after` | A visual transformation drives the convert |
| `routine-upgrade` | The viewer already has a routine; this is the slot-in |
| `gift` | The pitch is "for someone else" (mom / partner / kid) |

Every `Concept` of `kind='hook'` MUST carry one family tag — `performance-loop` correlates family with CTR / watch-time and feeds the result back via the `ugc-concept-engine:re-score-with-perf-feedback` job.

## Named formats (MJB primitive 26)

`namedFormat` is a soft tag (`'why-i-bought-this'`, `'wish-i-found-this-sooner'`, or `'none'`). The dashboard uses it for cross-product filtering — "show me every concept across every Product that uses 'wish-i-found-this-sooner'" — so the operator can see whether a format is exhausted in a brand lane.

## Sharp edges

- **The 5-question gate IS the firewall, not the LLM.** Do not "trust" the model to refuse fake-testimonial output — run the gate independently. A concept that passes is not necessarily great copy; it just isn't a compliance liability.
- **Brand-lane policy informs gate behavior.** Q5 (`brandLaneFit`) reads from the per-lane policy file. Re-gating after a policy update is a deliberate action: the existing `AuthenticityCheck` rows stay (audit history); a new check is added.
- **Cost-ledger gates regeneration.** A product can hit its work-allowance cap. When `cost-ledger` says no, the engine refuses — do not "fail open" and burn spend the operator didn't approve.
- **Only generate for launchable decision bands.** Subscribe to `product.scored` and filter on `decisionStateAfter ∈ { TEST, BUILD, SCALE }`. Generating for `SKIP` / `KILL` / `ARCHIVED` is wasted LLM spend.
- **Storyboards reference scripts but are independent rows.** A storyboard built from a script carries `scriptId` so the dashboard can show the lineage, but editing the script does NOT auto-regenerate the storyboard.
- **Performance feedback re-scores, does not rewrite.** When `performance-loop` reports a winning hook family, the engine queues a `re-score-with-perf-feedback` job that biases future generation — it does not retroactively edit existing Concept rows (history is append-only).
- **Model identifier on every row.** `Concept.model` is stored so a model rollback or A/B test does not lose attribution. Do not omit it.
