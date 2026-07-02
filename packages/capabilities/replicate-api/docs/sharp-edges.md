# Sharp edges — replicate-api

Every gotcha here is documented in the Replicate API reference. None of them
are guesses — they are real behaviors that will bite if you skim past them.

## 1. Sync mode is "wait up to N seconds", not a guarantee

`Prefer: wait=N` (N ∈ [1, 60]) leaves the request open while Replicate tries
to finish. If the model is slower than N, you get a normal response with
`status: 'starting'` and **must poll** `predictions.get` to actually wait for
it. Treat `waitSeconds` as a latency optimization only — `predictions.create`
+ `waitForCompletion(...)` is still the correct shape for "I want the final
output."

## 2. Input/output is purged after one hour

Predictions created via the API automatically clear their `input`, `output`,
and `logs` after ~1 hour. `data_removed` flips to `true`. If you need outputs
durably, copy them somewhere you control as soon as a run terminates. Output
files served from `replicate.delivery` disappear on the same clock.

## 3. Output files need the `Authorization` header

Anonymous `curl` against `https://replicate.delivery/...` returns 401. Stream
files through the same client that produced them, or proxy through a service
that carries the token. Allow-list both `replicate.delivery` and
`*.replicate.delivery` if you maintain an asset CSP / firewall.

## 4. Data URLs are capped at 256 KB

The API accepts files inline as data URLs but only up to 256 KB. Anything
larger must be a public HTTPS URL. The client does not enforce this — failures
surface as 4xx from Replicate after you send.

## 5. Model search uses a non-standard HTTP method

`models.search` is documented as `QUERY /v1/models` with a `text/plain` body,
not `POST` or `GET`. Some HTTP libraries and many proxies/CDNs reject custom
verbs. Native Node `fetch` and `undici` are fine; if you swap in a different
transport, verify it forwards `QUERY` correctly.

## 6. Search is in beta

Both `search.models` and the public `models.search` are flagged as beta in the
Replicate docs. Response shape — including the `metadata` block — can change.
The schemas use `.passthrough()` to absorb new fields without throwing, but do
not pin business logic to specific tags or `score` ranges.

## 7. `predict_time` is compute time, not wall time

`metrics.predict_time` is GPU/CPU time spent inside `predict()`. It excludes
queueing and worker boot. If you're budgeting end-to-end latency, use
`metrics.total_time` (when present) or `completed_at - created_at`.

## 8. Deletion has strict preconditions

- Models: only **private** models with **no versions** can be deleted. Delete
  every version first via `models.versions.delete`.
- Model versions: only from private models, and only if no one else has run
  it, no training depends on it, no deployment references it.
- Deployments: must have been offline and unused for at least 15 minutes.

The client surfaces these as 4xx errors — it does not try to clean up for you.

## 9. Default webhook delivery includes everything

If you set `webhook` without `webhook_events_filter`, Replicate sends `start`,
`output`, `logs`, and `completed`. `output` and `logs` are throttled to ≤ 1
event per 500 ms, but they still arrive frequently for chatty models. Always
set `webhook_events_filter` unless you genuinely need them all. Webhooks are
retried on network failure — handlers must be idempotent (key on
`prediction.id` + `status`).

## 10. Rate limits are per-token, per-endpoint

- `POST /predictions`: 600 / minute
- everything else: 3000 / minute

Hitting either returns a 429 with `Retry-After`. The client retries 429 up to
`maxRetries` (default 3) using that header — anything past that throws, so
add caller-level concurrency caps for high-volume workloads.

## 11. `version` accepts three formats — but official models drop the version

`predictions.create` takes any of:

- `{owner}/{name}` — **only** valid for official models (e.g.
  `black-forest-labs/flux-schnell`).
- `{owner}/{name}:{version_id}` — for any model.
- `{version_id}` — for any model.

If you pass `{owner}/{name}` for a non-official model, Replicate 422s. When in
doubt, resolve `latest_version.id` via `models.get(...)` and use the full
qualified form.

## 12. Account model limit: 1,000

`models.create` 4xxs once an account has 1,000 models. The Replicate docs
recommend pushing new versions of an existing model rather than creating new
models. Treat "create model" as setup, not a hot path.

## 13. List source filter is restrictive

`predictions.list({ source: 'web' })` is the only currently supported source
filter, and it caps results to the last 14 days. `source=api` is not yet a
valid filter — omit the param to get both.

## 14. `stream` field on create is deprecated

The `stream: true` request field is deprecated. Replicate already populates
`urls.stream` on the returned prediction when the model supports streaming —
read it from there. The client still accepts the field for backwards-compat,
but emits no warning.
