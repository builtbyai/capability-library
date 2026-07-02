# tools/new-capability

Scaffolds a new `packages/capabilities/<name>/` from `templates/capability-template/`. Replaces the manual `cp -r` instruction in the root README with a real CLI that:

- validates the name is kebab-case + unique
- copies the template tree
- rewrites placeholders (`CHANGE-ME`, `CAPABILITY_NAME_PLACEHOLDER`, `CAPABILITY_DESCRIPTION_PLACEHOLDER`) inside copied files
- emits `package.json` + `tsconfig.json` matching the conventions in `local-agent-terminal/`

## Run

```bash
node tools/new-capability/scaffold.mjs <kebab-name> "<short description>"
```

Example:

```bash
node tools/new-capability/scaffold.mjs audio-segmenter "VAD-based audio segmenter feeding transcription"
```

## What it deliberately does NOT do

- Doesn't touch `registry.yaml`. Promotion to the curated catalog is a deliberate manual step — write the manifest + contracts first, validate, then add the registry row.
- Doesn't touch `generated/`. Mechanical inventory regenerates from a scan; new caps don't go through that path.
- Doesn't auto-import anywhere. The capability is an island until you wire it into a workflow.
