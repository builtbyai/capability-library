# web-clipper · architecture

Extraction is a sequence of strategies over the same fetched DOM; first non-empty wins. `extractor` records which one fired.

```
fetch(url) → JSDOM(html) → [og:* | twitter:* | schema.org JSON-LD | readability] → turndown → markdown
                                                                                 → IntakePort.ingestUpload({mimeType:'text/markdown', source:'web_clip'})
                                                                                 → emit clip.normalized{ clipId, intakeObjectId }
```

JSDOM is shared across strategies (single parse). Per-domain throttle via `KeyedThrottle` keyed by `URL(url).hostname`. Headless fallback (`CLIP_HEADLESS_FALLBACK=true`) loads `playwright` lazily — keeps the cold path tiny.

**Boundary:** clipper produces markdown + emits `clip.normalized`. It calls intake to register the object; it does NOT emit `intake.object.received`. Intake owns that event.
