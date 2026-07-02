# replicate-api

Typed, zod-validated client for the [Replicate](https://replicate.com) REST
API (`https://api.replicate.com/v1`). One `createReplicate()` factory returns
a facade with services for every documented resource:

| Service | Covers |
|---|---|
| `predictions` | create / get / cancel / list / `waitForCompletion` |
| `models` | CRUD, search (`QUERY`), readme, examples, predictions, versions sub-service |
| `deployments` | CRUD + `createPrediction` |
| `trainings` | create / get / cancel / list / `waitForCompletion` |
| `collections` | get / list |
| `hardware` | list |
| `account` | get authenticated account |
| `webhooks` | default signing secret |
| `search` | beta `/v1/search` (models surface only) |

Auth, 429 retry-after, cursor pagination, sync mode (`Prefer: wait`), and
server-side cancellation deadlines (`Cancel-After`) are all handled by the
shared `ReplicateClient`.

## Install

This capability is consumed in-tree by the MultimarcDown workspace; no
npm publish yet. It only needs `zod` as a runtime dep and `fetch` (Node 18+
native, or any compatible polyfill passed via `config.fetch`).

## Quick start

```ts
import { createReplicate } from '@multimarcdown/replicate-api';

const replicate = createReplicate({
  apiToken: process.env.REPLICATE_API_TOKEN!,
});

const prediction = await replicate.predictions.create(
  {
    version:
      'replicate/hello-world:5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa',
    input: { text: 'Alice' },
  },
  { waitSeconds: 30, cancelAfter: '2m' },
);

const final = await replicate.predictions.waitForCompletion(prediction.id);
console.log(final.output); // -> "hello Alice"
```

## Pagination

Every list endpoint exposes three flavours:

```ts
// one page only
const page = await replicate.predictions.listPage();

// everything (walks the `next` cursor)
const all = await replicate.predictions.listAll();

// async generator — yield one page at a time
for await (const batch of replicate.predictions.listPages()) {
  console.log(batch.length);
}
```

## Webhooks

```ts
await replicate.predictions.create({
  version: '...',
  input: { ... },
  webhook: 'https://example.com/hooks/replicate',
  webhook_events_filter: ['start', 'completed'],
});

const { key } = await replicate.webhooks.defaultSecret();
// use `key` to HMAC-verify incoming webhook bodies
```

If you omit `webhook_events_filter`, Replicate sends all four event types
(`start`, `output`, `logs`, `completed`) — see `docs/sharp-edges.md` §9.

## Models, deployments, trainings

```ts
// Find an official model and run it
const flux = await replicate.models.get('black-forest-labs', 'flux-schnell');
const p = await replicate.models.createOfficialPrediction(
  'black-forest-labs',
  'flux-schnell',
  { input: { prompt: 'a robot iron man bicycling over the moon' } },
  { waitSeconds: 60 },
);

// Stand up a deployment of an arbitrary version
const deployment = await replicate.deployments.create({
  name: 'my-app-image-generator',
  model: 'stability-ai/sdxl',
  version: 'da77bc59ee60423279fd632efb4795ab731d9e3ca9705ef3341091fb989b7eaf',
  hardware: 'gpu-t4',
  min_instances: 0,
  max_instances: 3,
});

// Kick off a training and wait
const training = await replicate.trainings.create(
  'stability-ai',
  'sdxl',
  'da77bc59ee60423279fd632efb4795ab731d9e3ca9705ef3341091fb989b7eaf',
  {
    destination: 'acme/my-finetune',
    input: { input_images: 'https://example.com/inputs.zip' },
    webhook: 'https://example.com/hooks/replicate',
  },
);
const done = await replicate.trainings.waitForCompletion(training.id);
```

## Error handling

Non-2xx responses throw `ReplicateApiError`:

```ts
import { ReplicateApiError } from '@multimarcdown/replicate-api';

try {
  await replicate.predictions.get('does-not-exist');
} catch (err) {
  if (err instanceof ReplicateApiError) {
    console.log(err.status, err.body); // 404, { detail: 'Not found' }
  }
}
```

429s are retried automatically using `Retry-After` (up to `maxRetries`,
default 3). All other statuses throw immediately.

## Verify the setup

```bash
REPLICATE_API_TOKEN=r8_... npx tsx scripts/verify.ts
```

Walks the three-rung diagnostic ladder from `docs/diagnostics.runbook.md`:
account → hardware → end-to-end `hello-world` prediction.

## Layout

```
replicate-api/
  manifest.yaml
  README.md
  contracts/
    config.schema.ts
    schemas.ts
    events.ts
  backend/
    replicate.client.ts
    predictions.service.ts
    models.service.ts
    deployments.service.ts
    trainings.service.ts
    collections.service.ts
    hardware.service.ts
    account.service.ts
    webhooks.service.ts
    search.service.ts
    index.ts
  docs/
    architecture.md
    diagnostics.runbook.md
    sharp-edges.md
  scripts/
    verify.ts
```

See [`docs/sharp-edges.md`](docs/sharp-edges.md) before relying on this in
production — 14 documented behaviors that will bite (1-hour data retention,
auth needed for output file URLs, beta search, deletion preconditions, etc).
