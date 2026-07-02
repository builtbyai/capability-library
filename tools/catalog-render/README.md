# tools/catalog-render

Regenerates the auto-derived index files in `knowledge/specs/` from the live manifests. Replaces the hand-maintained catalogs with an idempotent build step.

## Run

```bash
node tools/catalog-render/render.mjs
```

Outputs:
- `knowledge/specs/jobs-and-events-catalog.md`
- `knowledge/specs/api-and-ui-catalog.md`

## When to run

- After adding or modifying any `packages/capabilities/*/manifest.yaml`.
- Before reading the catalogs to verify they reflect the live tree.
- In CI before merge.

## Wire into npm

```json
{ "scripts": { "catalog:render": "node tools/catalog-render/render.mjs" } }
```

## Why not just symlink?

The catalogs are searchable text aggregates — they're easier to read than 14 separate manifests. Generating them keeps the human-readable surface in sync with the machine-readable one.
