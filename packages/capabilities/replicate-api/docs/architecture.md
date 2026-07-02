# Architecture — replicate-api

A thin, typed wrapper over the Replicate REST API. There is no persistence,
no daemon, no UI — just an HTTP client + per-resource services that share a
single auth + transport layer.

## Chain

```
caller (your capability / workflow)
  → createReplicate({ apiToken })
    → ReplicateClient            # auth, retries, pagination, sync mode
      → fetch                    # native (Node 18+) or injected
        → api.replicate.com/v1
```

## File layout

```
replicate-api/
  manifest.yaml
  contracts/
    config.schema.ts             # zod for ReplicateClientConfig
    schemas.ts                   # zod for Prediction, Model, ..., Paginated<T>
    events.ts                    # normalized event shapes for bus.emit
  backend/
    replicate.client.ts          # HTTP transport (auth, headers, 429 retry,
                                 # paginate generator, paginateAll, request,
                                 # requestParsed)
    predictions.service.ts       # create / get / cancel / list / waitForCompletion
    models.service.ts            # CRUD + .versions + .search (QUERY method) + .readme + .examples
    deployments.service.ts       # CRUD + .createPrediction
    trainings.service.ts         # create / get / cancel / list / waitForCompletion
    collections.service.ts       # get / list
    hardware.service.ts          # list
    account.service.ts           # get
    webhooks.service.ts          # default secret
    search.service.ts            # beta /v1/search
    index.ts                     # createReplicate() facade + re-exports
  scripts/
    verify.ts                    # diagnostic ladder against a real token
```

## Resource → endpoint map

| Service.method | HTTP |
|---|---|
| `predictions.create` | `POST /predictions` |
| `predictions.get` | `GET /predictions/{id}` |
| `predictions.cancel` | `POST /predictions/{id}/cancel` |
| `predictions.listPage` / `listAll` / `listPages` | `GET /predictions` |
| `predictions.waitForCompletion` | polls `GET /predictions/{id}` |
| `models.create` | `POST /models` |
| `models.get` | `GET /models/{owner}/{name}` |
| `models.listAll` / `listPages` | `GET /models` |
| `models.update` | `PATCH /models/{owner}/{name}` |
| `models.search` | `QUERY /models` (text/plain body) |
| `models.delete` | `DELETE /models/{owner}/{name}` |
| `models.readme` | `GET /models/{owner}/{name}/readme` |
| `models.examplesAll` | `GET /models/{owner}/{name}/examples` |
| `models.createOfficialPrediction` | `POST /models/{owner}/{name}/predictions` |
| `models.versions.get` | `GET /models/{owner}/{name}/versions/{id}` |
| `models.versions.listAll` | `GET /models/{owner}/{name}/versions` |
| `models.versions.delete` | `DELETE /models/{owner}/{name}/versions/{id}` |
| `deployments.create` | `POST /deployments` |
| `deployments.get` | `GET /deployments/{owner}/{name}` |
| `deployments.listAll` | `GET /deployments` |
| `deployments.update` | `PATCH /deployments/{owner}/{name}` |
| `deployments.delete` | `DELETE /deployments/{owner}/{name}` |
| `deployments.createPrediction` | `POST /deployments/{owner}/{name}/predictions` |
| `trainings.create` | `POST /models/{owner}/{name}/versions/{id}/trainings` |
| `trainings.get` | `GET /trainings/{id}` |
| `trainings.cancel` | `POST /trainings/{id}/cancel` |
| `trainings.listAll` | `GET /trainings` |
| `collections.get` | `GET /collections/{slug}` |
| `collections.listAll` | `GET /collections` |
| `hardware.list` | `GET /hardware` |
| `account.get` | `GET /account` |
| `webhooks.defaultSecret` | `GET /webhooks/default/secret` |
| `search.models` / `search.raw` | `GET /search?query=...&limit=...` |

## Auth

Bearer token in the `Authorization` header. Source it from `REPLICATE_API_TOKEN`
in the caller and pass it to `createReplicate({ apiToken })`. The capability
does not read the env directly — that's the caller's job, so token rotation
stays a single-layer concern.

## Retries

Only 429 is retried (up to `maxRetries`, default 3) honouring `Retry-After`.
All other non-2xx statuses throw `ReplicateApiError` immediately. The Replicate
docs publish two limits: 600/min for `predictions.create`, 3000/min for
everything else.

## Sync mode

`predictions.create`, `models.createOfficialPrediction`, and
`deployments.createPrediction` accept `{ waitSeconds }` which the client emits
as `Prefer: wait=N` (clamped 1-60). The response may still be `starting` if the
model didn't finish in time — the contract says poll `predictions.get` to
complete.

## Cancel-After

Pass `cancelAfter: '30s' | '5m' | '1h30m45s'` on create to set a server-side
deadline. Minimum 5 s, enforced server-side. Useful for safety nets in worker
pipelines that might otherwise drift.

## Pagination

Every list endpoint follows the same cursor shape:
`{ next: string | null, previous: string | null, results: T[] }`. The client
exposes three flavours per resource: `listPage(...)` (one page), `listAll(...)`
(walk the cursor and concat), and `listPages(...)` (an async generator).
