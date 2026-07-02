# og-unfurl-proxy · sharp edges

## 1. UA spoof is a strict superset, not a bypass

Hostinger's JS challenge passes for any Chrome UA. Real browsers already pass. This proxy only helps crawlers. Do NOT market it as "bypass bot protection" — it is "let crawlers see the Open Graph tags."

## 2. Spoofed UA must be a real, recent Chrome version

A stale UA (Chrome 100) is itself a bot signal. Bump the version quarterly. Hardcode in `SPOOFED_UA` const so updates are obvious in diffs.

## 3. Route pattern collisions are deploy-time silent

Wrangler doesn't warn if two Workers claim the same route pattern. The newer-deployed wins, the older orphans. Check `wrangler deployments list` for stranded Workers after a deploy.

## 4. Observability=enabled emits Workers Analytics

Free tier caps at 100k requests/day for analytics; over that, sampling kicks in and `og-proxy.crawler.detected` events lose recall. Document in the runbook.

## 5. Crawler UA list rot

Facebook + Twitter periodically add new variants (`facebookexternalhit/1.1` -> `meta-externalagent`). Drive the UA list via env var so it can be hot-rolled without redeploying the Worker.

