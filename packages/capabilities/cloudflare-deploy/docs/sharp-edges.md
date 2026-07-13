# cloudflare-deploy · sharp edges

## 1. Wrangler silently deploys stale build/

The whole reason this capability exists. `npm run build` can fail (TypeScript error, OOM, missing dep) AND `wrangler pages deploy build` will still succeed using whatever was last in `build/`. The deploy log says "complete." The site serves yesterday's code. **Always hash-verify.**

## 2. Hash-mismatch on Pages can be legitimate

CF Pages does HTML compression + may add headers to deployed assets. Bytes-identical compare is too strict. Use: hash content **after** stripping `Server`, `cf-*`, `Date` headers and decompressing. The capability ships a normalizer in `src/normalize-asset.ts`.

## 3. D1 migrations are NOT atomic across remote+local

`wrangler d1 execute --remote --file=migration.sql` applies to remote. The local replica needs a separate `--local` invocation. If a workflow runs migrate then queries, the local query sees yesterday's schema. Always run both or pass `--local` consistently.

## 4. Wrangler OAuth vs API token

Per user memory `wrangler_local_oauth_pages_deploy.md`, node-a has OAuth-authed wrangler with `pages:write`. Adding a `CLOUDFLARE_API_TOKEN` env can ACCIDENTALLY override OAuth and produce a 401 if the token lacks the right scope. Check both at startup; prefer OAuth if both are present and OAuth is valid.

## 5. R2 deploys via wrangler are 28× slower than AWS SDK

For `bulk-media-import`-style usage, deploys of many R2 objects via `wrangler r2 object put` take ~1.5s per object. The capability defers to `bulk-media-import` for >50 objects and uses wrangler only for one-offs (single asset push).
