# Diagnostics runbook — replicate-api

Walk this in order. Each rung tells you what to run, what passing looks like,
and what to do if it fails. The verify script (`scripts/verify.ts`) executes
rungs 1-3 in sequence.

## 1. Token validity

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  https://api.replicate.com/v1/account
```

- **Pass:** `200`
- **`401`:** token is wrong, revoked, or has no scope. Rotate at
  https://replicate.com/account/api-tokens and update the secret store.
- **`403`:** account is suspended. Contact Replicate support; client cannot
  recover.
- **Network failure:** check egress — `api.replicate.com` must be reachable.
  Add `replicate.delivery` and `*.replicate.delivery` to any allow-list before
  download steps below.

## 2. Catalog reachability

```ts
await replicate.hardware.list();
```

- **Pass:** non-empty array containing at least `{ sku: 'cpu' }`.
- **Fail with 401/403:** same remediation as rung 1.
- **Fail with 429:** you are throttled. Sleep until `Retry-After`; raise it
  with Replicate if this is sustained ([support](https://replicate.com/support)).

## 3. End-to-end smoke prediction

```ts
const p = await replicate.predictions.create(
  {
    version:
      'replicate/hello-world:5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa',
    input: { text: 'diagnostics' },
  },
  { waitSeconds: 30 },
);
const done = await replicate.predictions.waitForCompletion(p.id, {
  timeoutMs: 120_000,
});
console.log(done.status, done.output);
```

- **Pass:** terminal status `succeeded`, `output === 'hello diagnostics'`.
- **Stuck in `starting`:** Replicate is warming a worker. Wait or raise
  `timeoutMs`. If it never leaves `starting`, the model itself is unhealthy —
  not your client.
- **`failed`:** read `done.error`; if it mentions input validation, your input
  shape is wrong for the model version.

## 4. Webhook signature (only if you configured webhooks)

```ts
const { key } = await replicate.webhooks.defaultSecret();
```

- **Pass:** non-empty `key`. Use it to verify the HMAC of inbound webhook
  bodies as described in the Replicate webhook docs.
- **Fail:** webhooks are not configured for this account; either skip
  signature verification or set up the default endpoint at
  https://replicate.com/account/webhooks.

## 5. Output file retrieval

Predictions and trainings store output URLs on `replicate.delivery`. Files are
purged ~1 hour after the run by default.

- If `data_removed === true`, the run's input/output have been deleted — there
  is nothing left to fetch. Save copies in your own storage as soon as the run
  reaches a terminal state.
- Files require the `Authorization` header to download. Plain anonymous GETs
  will 401.
