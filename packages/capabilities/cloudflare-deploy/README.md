# cloudflare-deploy · _planned_

Unified Cloudflare deploy surface. Pages, Workers, D1, KV, R2, Hyperdrive. The 4 existing skills (`cf-sync`, `deploy-pipeline`, `safe-pages-deploy`, `cloudflare-deploy`) each rebuilt the wrangler wrapper + hash verification; this consolidates.

**Surfaces:** DeployButton, DeployHistoryTable, BuildLogViewer, RollbackPanel, HashVerifyBadge
**Emits:** `cf.deploy.requested`, `cf.deploy.completed`, `cf.deploy.failed`, `cf.deploy.hash-verified`, `cf.rollback.completed`
**Depends on:** connector-config, notify

## Hash verification is non-negotiable

Per the user's memory `deploy_verification_rule.md`: wrangler will silently upload a stale `build/` if `npm run build` failed. The deploy log says "✨ Deployment complete" while the site serves yesterday's bundle. This capability:

1. Runs `preDeployHooks` (npm run build) and HARD-FAILS the deploy on non-zero exit. No "ship anyway" mode.
2. Hashes the local build root BEFORE upload.
3. After deploy, fetches the live bundle and hashes it.
4. Emits `cf.deploy.hash-verified{match: bool}`. If `match: false`, the deploy is flagged.

The `/safe-pages-deploy` skill currently does this in user-shell; the capability lifts it into the catalog.

## Rollback

Cloudflare keeps deploy history; rollback is a wrangler API call. The capability exposes it with confirmation gating because Pages rollback is irreversible-ish (the rolled-from deploy stays in history but the canonical alias moves).
