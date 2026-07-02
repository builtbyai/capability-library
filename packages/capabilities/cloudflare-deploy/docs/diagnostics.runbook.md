# cloudflare-deploy · diagnostics runbook

## Rung 1 — wrangler available

```bash
wrangler --version       # exit 0 + version 3.x+
wrangler whoami          # confirms auth (OAuth or token)
```

## Rung 2 — recent deploys

```bash
curl http://127.0.0.1:5111/api/cf/deploys?projectName=<x>
```

Look at the most recent: `hashMatch` should be `true`. `hashMatch: false` is the canary for the stale-build bug.

## Rung 3 — smoke deploy

Deploy a known-good fixture project and verify hash match. If a deploy succeeds but hashMatch is false, the live bundle differs from local — either (a) build was stale (the bug), (b) normalizer didn't strip CF-injected headers (sharp-edges #2), or (c) a CDN is in front and serving an older cache.

## Symptom → cause

| Symptom | Cause |
|---|---|
| `cf.deploy.failed{stage:'pre-hook'}` | `npm run build` exited non-zero. Fix the build; do NOT bypass. |
| `cf.deploy.hash-verified{match:false}` | Sharp-edges #1 (stale build/) or sharp-edges #2 (normalizer too strict). Inspect both. |
| D1 query sees old schema after migrate | Sharp-edges #3 — separate local vs remote application. |
| Wrangler suddenly 401 | Sharp-edges #4 — env token shadowed OAuth. Unset `CLOUDFLARE_API_TOKEN` to test. |
| Bulk R2 push 30× slower than expected | Wrong path; use bulk-media-import for >50 objects (sharp-edges #5). |
