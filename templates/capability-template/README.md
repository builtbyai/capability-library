# capability-template

Copy this folder to `packages/capabilities/<your-capability>`, then:

1. Fill in `manifest.yaml` (id, surfaces, env, secrets, events, health checks).
2. Add an entry to the root `registry.yaml`.
3. Implement against the **contracts** first (define your events + zod schemas
   before the service), then the service, then the UI.
4. Write the three docs (`architecture.md`, `diagnostics.runbook.md`,
   `sharp-edges.md`). The sharp-edges file is not optional.

## Canonical shape

```
<capability>/
  manifest.yaml          machine-readable declaration
  README.md
  frontend/              *.component.tsx, *.store.ts, *.client.ts, index.ts
  backend/               *.service.ts, *.adapter.ts, *.worker.ts, *.daemon.ts, index.ts
  cloudflare/            worker + durable-objects (only if needed)
  contracts/             *.schema.ts (zod), *.events.ts — the stable surface
  scripts/               install.sh / install.bat / verify.ts
  docs/                  architecture.md, diagnostics.runbook.md, sharp-edges.md
```

## Naming conventions

| Suffix | Meaning |
|--------|---------|
| `*.component.tsx` | visual React component |
| `*.store.ts` | client-side persistent state |
| `*.client.ts` | frontend API client |
| `*.service.ts` | domain/application service |
| `*.adapter.ts` | external provider adapter (gmail, leaflet, vectorize…) |
| `*.worker.ts` | async processor |
| `*.daemon.ts` | local long-running process |
| `*.schema.ts` | zod / json-schema contracts |
| `*.events.ts` | event definitions |

## The "do not code twice" checklist

Before a capability is accepted into the library, it should answer yes to:

1. Can it be installed into a new dashboard without copying random files?
2. Does it have a manifest?
3. Does it declare required env vars and secrets?
4. Does it declare all API routes?
5. Does it declare all events?
6. Does it have a health check?
7. Does it have a diagnostic runbook?
8. Does it have a setup script?
9. Does it have a minimal example?
10. Does it separate domain model from provider adapter?
11. Does it support dry-run mode if it mutates files/data?
12. Does it store provenance for generated/modified artifacts?
13. Does it have a known-sharp-edges section?
14. Can another AI/developer understand how to port it?

Use `local-agent-terminal` as the worked reference — it answers yes to all of these.
