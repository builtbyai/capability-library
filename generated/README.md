# generated/

Everything under this directory is **machine-emitted** — safe to delete and
regenerate. Nothing here is a source of truth, and `@multimarcdown/core` does
not load any of it.

The scan/aggregate tooling in `tools/scan/` writes:

- `inventory/modules-index.json` — machine-readable catalog of every discovered
  code module (path, language signals, last-modified, README excerpt).
- `inventory/MODULES.md` — the same catalog rendered as a large human-readable
  table.
- `inventory/stubs/<bucket>/*.stub.md` — one short stub per discovered module,
  sharded by drive + first path segment.
- `registry-discovered.yaml` — the mechanical inventory split out of the curated
  root `registry.yaml`.

These artifacts are intentionally **excluded from version control** (they are
large, environment-specific, and reproducible). Regenerate them with:

```bash
npm run scan:aggregate
```

The curated catalog a human maintains lives in the root `registry.yaml`; the
`discovered:` payload here is only reference material and is never promoted to a
capability without hand-authoring its `manifest.yaml`, contracts, and docs.
