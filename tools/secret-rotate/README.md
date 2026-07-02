# tools/secret-rotate

Walk the connector-config registry, identify connectors whose secret has aged past per-type policy, and trigger rotation. Auto-rotates what can be auto-rotated (Gmail OAuth refresh); emits `notify` for human action on the rest (R2 tokens, WhatsApp MCP tokens, gvoice HMAC).

## Run

```bash
# Dry run — list what's due without acting
node tools/secret-rotate/rotate.mjs --dry-run

# Execute — auto-rotate gmail, notify for everything else
node tools/secret-rotate/rotate.mjs

# Custom endpoints (e.g. cross-machine)
node tools/secret-rotate/rotate.mjs --connector-config-url http://10.10.10.2:5102
```

## Policy (max age before rotation)

| Connector type | Max age |
|---|---|
| `gmail` | 7 days (Google Testing-mode token cap) |
| `cloudflare`, `cloudflare-vectorize` | 90 days |
| `r2` | 60 days |
| `imap`, `smtp` | 180 days |

Override by editing `maxAgeByType` in `rotate.mjs`. Eventually this should move to a per-deployment config file under `connector-config`.

## Cron integration

Schedule via the `scheduler` capability:

```ts
scheduler.registerCron({
  name: 'tools:secret-rotate',
  cron: '0 9 * * 1',  // every Monday 9am
  capabilityId: 'tools',
  handler: 'secret-rotate',
  input: {},
});
```

## Why not in-capability?

This is a cross-capability operation — it touches `connector-config`, `notify`, `email-connector`. Making it a tool keeps each cap independent; the tool is the orchestration layer that knows about all three.
