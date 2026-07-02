# TypeScript Error Ledger

> Generated 2026-06-29 from `npx tsc -b` at session end. **118 pre-existing errors** across 5 capability surfaces + 12 workflow recipes. None introduced by the MJB capability scaffolding work (47-cap library, all new contracts/manifests compile clean).
> Policy (from user playbook): do NOT blanket-fix. Only fix what blocks active build/test/MJB MVP work; rest stay parked here until prioritized.

## Headline counts by file

| Errors | File | Severity tier |
|---|---|---|
| 20 | `packages/capabilities/replicate-api/backend/index.ts` | service-code (prototype) |
| 15 | `packages/capabilities/e-signature/frontend/hooks/useSignatureCanvas.ts` | service-code (prototype, `noUncheckedIndexedAccess` strict-mode) |
| 5 | `packages/capabilities/e-signature/backend/index.ts` | service-code (prototype, incomplete return values) |
| 4 | `packages/capabilities/local-agent-terminal/frontend/terminalStore.ts` | service-code (production-ready, strict-mode gaps) |
| 3 | `packages/workflows/booking-to-video-call/recipe.ts` | workflow recipe (cross-package import without proper project ref) |
| 3 | `packages/capabilities/replicate-api/backend/search.service.ts` | service-code |
| 3 | `packages/capabilities/local-agent-terminal/cloudflare/pty-router.ts` | service-code (Cloudflare Workers types) |
| 2 | `packages/workflows/pdf-to-rag/recipe.ts` | workflow recipe |
| 2 | `packages/workflows/media-upscale-batch/recipe.ts` | workflow recipe |
| 2 | `packages/workflows/gmail-to-rag/recipe.ts` | workflow recipe |
| 2 | `packages/workflows/folder-watch-import/recipe.ts` | workflow recipe |
| 2 | `packages/workflows/audio-to-rag/recipe.ts` | workflow recipe |
| 2 | `packages/capabilities/replicate-api/scripts/verify.ts` | one-off script |
| 2 | `packages/capabilities/replicate-api/backend/webhooks.service.ts` | service-code |
| 2 | `packages/capabilities/replicate-api/backend/predictions.service.ts` | service-code |
| 2 | `packages/capabilities/replicate-api/backend/models.service.ts` | service-code |
| 2 | `packages/capabilities/replicate-api/backend/account.service.ts` | service-code |
| 2 | `packages/capabilities/replicate-api/backend/trainings.service.ts` | service-code |
| 1 | `packages/capabilities/replicate-api/backend/replicate.client.ts` | service-code |
| 1 | `packages/capabilities/replicate-api/backend/hardware.service.ts` | service-code |
| 1 | `packages/capabilities/replicate-api/backend/deployments.service.ts` | service-code |
| 1 | `packages/capabilities/replicate-api/backend/collections.service.ts` | service-code |
| 1 | `packages/capabilities/local-agent-terminal/cloudflare/pty-router.ts` (additional) | service-code |
| various | misc 1-error files | various |

## Severity tiers

### Tier A — blocks active MJB MVP build (FIX ASAP when touching that path)
**Count: 0.** All MJB MVP capabilities (cost-ledger, product-intelligence, product-registry, product-scoring, ugc-concept-engine, funnel-builder, social-distribution, performance-loop) compile clean. No tier-A errors today.

### Tier B — blocks adjacent capability if you start service work there (FIX WHEN YOU TOUCH THAT CAP)
- **`replicate-api/backend/*`** (~38 errors total). Blocks any service work on replicate-api. Fixes are real implementation work: missing return types, incomplete Promise paths, strict-mode null/undefined guards. MJB MVP depends on replicate-api transitively (via media-generation + media-processing), but only at contract level — the broken service code does NOT block MJB until you wire media-generation to actually call it.
- **`e-signature/backend + frontend`** (~25 errors). Blocks any work on e-sig. Per the DeepSeek audit, e-sig has a covert MJB role (supplier sample-order agreements, primitive 68) — but that's a post-MVP need.
- **`local-agent-terminal/frontend + cloudflare`** (~7 errors). Affects the production-ready terminal capability. Not in MJB critical path.

### Tier C — workflow recipes use cross-package imports without project refs (ARCHITECTURAL — FIX WHEN BUILDING WORKFLOWS LAYER)
**Count: ~12 across 6 workflow recipes.** Each `packages/workflows/*/recipe.ts` imports from `packages/capabilities/*/contracts/events.ts` but the workflow's `tsconfig.json` does NOT declare the capability as a project reference. TS6059 + TS6307. Fix is mechanical: add the right `references[]` entries to each workflow's tsconfig.json. Won't be touched until workflows become an active build target.

### Tier D — strict-mode chores in script-level files (FIX OPPORTUNISTICALLY)
- `packages/capabilities/replicate-api/scripts/verify.ts` (2 errors)
- One-off scripts that exist but aren't hot paths.

## Recommended action policy

1. **Default: do not fix.** These errors have existed since the initial commit and are not contaminating MJB MVP work.
2. **When you start service code on `<capability>`:** fix all errors in `<capability>` first before adding new service files. Don't paper over with `// @ts-ignore`.
3. **When adding a workflow:** fix that workflow's project-references first.
4. **Never blanket-fix.** Each error is a real signal about incomplete implementation — silencing them all loses information.

## Refresh

To regenerate this file:
```bash
cd C:/Code/CODE_MODULE_LIBRARY
npx tsc -b 2>&1 | grep -E "^[^ ]" | awk -F'(' '{print $1}' | sort | uniq -c | sort -rn
```

Last refreshed: 2026-06-29 (commit at end of session 8 — see git log for the surrounding context).
