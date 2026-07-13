# Code Module Library — Directory Index

> A portable, full-stack **capability library**: a catalog of vertically-integrated
> capabilities where each module ships its own UI + backend + optional cloud relay
> + typed contracts + diagnostics + install surface.

For the narrative overview, maturity map, and highlighted modules, see
[`README.md`](README.md). This file is a flat map of the tree.

## Root

| File | Purpose |
|---|---|
| `README.md` | Project overview, maturity map, getting started |
| `registry.yaml` | Curated capability catalog (48 entries) — single source of truth |
| `index.ts` | Re-export surface for `@multimarcdown/core` |
| `package.json` | Workspace root: `packages/{core,ui,capabilities/*,adapters/*,workflows/*}` |
| `tsconfig*.json` | Project references + shared compile options |
| `eslint.config.js` / `vitest.config.ts` | Lint (ESLint 9 flat config) + test config |
| `.github/workflows/ci.yml` | CI: typecheck, registry validation, tests, lint |

## packages/ — the four layers

Organizing principle: **ui → feature → capability → workflow**. Technologies
(Cloudflare, node-pty, Gmail, Leaflet) are adapters, never the organizing principle.

### packages/core/
Shared abstractions every capability builds on: `bus` (events), `jobs`, `health`,
`secrets`, `config`, `logging`, `manifest` (zod schema), `registry` (loads +
validates `registry.yaml`), plus hoisted primitives — `intake`, `chunks`,
`backoff`, `checksums`, `mime-sniff`, `throttle`, `http-client`, `cost-ledger`,
`dry-run`, `model-invocation`.

### packages/ui/
Reusable visual components — no backend (e.g. `StatusBadge`).

### packages/capabilities/ (48)
Each ships `manifest.yaml`, `contracts/` (zod events + schemas), and
`docs/{architecture,sharp-edges,diagnostics.runbook}.md`. Maturity varies —
`registry.yaml`'s `status` field is authoritative (2 production-ready, 5
prototype, 41 planned). Fully built reference: **local-agent-terminal**;
throughput pipeline: **bulk-media-import**; typed client: **replicate-api**.

### packages/adapters/ (11)
Provider implementations of capability ports: `gmail`, `imap`
(`EmailConnectorPort`); `deepseek`, `anthropic`, `ollama`, `replicate`
(`ModelInvocation`); `ffmpeg` (`MediaTranscodePort`); `leaflet`, `google-earth`
(renderer / KML I/O); `cloudflare-vectorize` (`VectorIndexPort`);
`local-filesystem` (path normalization).

### packages/workflows/ (25)
Composition recipes — no domain logic. Ingest (`pdf-to-rag`,
`folder-watch-import`, `web-bookmark-to-notes`, …), AI (`bulk-rename-folder`,
`media-upscale-batch`, `claude-code-via-deepseek`, …), cross-capability
(`gmail-to-rag`, `terminal-with-scheduled-claude`, `connector-health-rollup`, …).

## templates/
- `capability-template/` — copy to scaffold a new capability.

## knowledge/ — human-authored docs
| Subdir | Purpose |
|---|---|
| `specs/` | Long-lived design specs (`component-library-spec-embedded-terminal.md`, `pty-claude-component.md`, `sharp-edges-cross-capability.md`, `jobs-and-events-catalog.md`) |
| `guides/{frontend,native,llm}/` | Cookbooks: react/shadcn best practices, native UI, LLM/DeepSeek KB |
| `decisions/` | Design records: `mjb-primitives.md`, `mjb-traceability.md`, `wiring-graph.md`, `ts-error-ledger.md` |

## tools/ — repo-local CLIs
`scan/` (module discovery), `manifest-validate/`, `scaffold/` + `new-capability/`,
`catalog-render/`, `digest-renderer/`, `fleet-dispatch/`, `fleet-health/`,
`gpu-snapshot/`, `mega-watchdog/`, `ollama-route/`, `secret-rotate/`, `ssh-fleet/`,
`vocr/`.

## generated/ — machine-emitted (git-ignored)
Reproducible inventory (`inventory/`, `registry-discovered.yaml`) written by
`npm run scan:aggregate`. See [`generated/README.md`](generated/README.md).

## mockups/
UI design mockups + `screenshots/`. `design-lab.html` is self-contained and
GitHub-Pages-hostable as a live visual demo.
