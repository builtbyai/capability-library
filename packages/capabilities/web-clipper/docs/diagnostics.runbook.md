# web-clipper · diagnostics runbook

## Rung 1 — fetch a known URL

```bash
curl -X POST http://127.0.0.1:5103/api/clip \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

Expect 200 + `markdown.length > 100`.

## Rung 2 — extractor coverage metric

```bash
curl http://127.0.0.1:5103/api/clip/_metrics
```

`readability_fallback_rate` should be < 0.5. If higher, og/twitter/schema-org strategies aren't firing — likely a JSDOM bundling issue (sharp-edges #1).

## Rung 3 — per-URL debug

```bash
curl -X POST http://127.0.0.1:5103/api/clip?debug=true -d '{"url":"..."}'
```

Returns which extractor fired and intermediate DOM size.

## Symptom → cause

| Symptom | Cause |
|---|---|
| Empty markdown | SPA, no headless fallback. Enable `CLIP_HEADLESS_FALLBACK=true`. |
| Broken image links | `og:image` resolved against pre-redirect URL. Sharp-edges #2. |
| 429s clipping a feed | Per-URL throttle instead of per-domain. Sharp-edges #4. |
