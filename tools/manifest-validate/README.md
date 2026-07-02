# tools/manifest-validate

Walks every `packages/{capabilities,workflows}/*/manifest.yaml` and validates against `CapabilityManifestSchema` from `@multimarcdown/core/manifest.ts`. Exits non-zero on any failure.

## Run

```bash
node tools/manifest-validate/validate.mjs
```

Add to `package.json`:

```json
{ "scripts": { "validate:manifests": "node tools/manifest-validate/validate.mjs" } }
```

## When to run

- Before `npm run registry:print` — the registry loader only validates the curated `capabilities:` block; this catches errors in workflows + adapter manifests too.
- After any edit to a manifest (or to `manifest.ts`).
- In CI before merge.

## Fallback behavior

If `packages/core/dist/` doesn't exist (no build run yet), the tool drops to a lenient duck-type check that verifies only `id`, `name`, `kind`. This keeps the tool usable in spec-and-seed state.
