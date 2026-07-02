# web-clipper · sharp edges

## 1. `@mozilla/readability` requires a real `Document`, not cheerio

You MUST use jsdom for the readability path; cheerio's pseudo-DOM silently returns null. Build both parses (jsdom + cheerio for selector paths) or use jsdom for everything.

## 2. `og:image` is relative to `finalUrl`, not `url`

A clipper that resolves against the pre-redirect URL gets wrong image links on every site that redirects through a CDN. Always resolve relative URLs against `response.url` after fetch.

## 3. SPA-rendered content returns near-empty markdown via cheerio + readability

Symptom: `markdown.length < 200` for a page that visibly has 3000 words in browser. Detection: track `readability_fallback_rate` per domain — high rate + tiny output → need `CLIP_HEADLESS_FALLBACK=true` or a domain-specific template.

## 4. Rate-limit at the domain level, not the URL level

`KeyedThrottle` keyed on hostname; otherwise a "clip this whole RSS feed" workflow trips 429s on the 4th item.

## 5. Markdown can be huge — cap it

`CLIP_MAX_BYTES` caps inline markdown (default 5MB). Above that, store the bytes via IntakeObject (so downstream `document-ingestion` chunks it) rather than inline in `CapturedClip.markdown`.
