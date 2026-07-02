# og-unfurl-proxy · _planned_

Cloudflare Worker proxy that sits in front of a host with bot-challenge protection (Hostinger, certain WAFs) and spoofs a desktop Chrome User-Agent so crawlers (Facebookexternalhit, Twitterbot, WhatsApp, Discordbot, LinkedInBot) can fetch Open Graph meta tags. Real users unaffected. Originally `jalenward-unlock-proxy` on G:.

**Surfaces:** ProxyStatusCard, CrawlerHitChart, UASpoofConfigEditor, RouteListPanel
**Emits:** `og-proxy.request.intercepted`, `og-proxy.crawler.detected`, `og-proxy.upstream.failed`
**Jobs:** `og-unfurl-proxy:deploy-worker`, `og-unfurl-proxy:test-route`
**Depends on:** cloudflare-deploy, notify

See `docs/sharp-edges.md` for project-specific landmines.
