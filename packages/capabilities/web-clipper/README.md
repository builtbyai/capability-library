# web-clipper  ·  _prototype_

Capture web pages into canonical markdown notes with layered fallback extraction,
then hand the result to `intake-pipeline` like any other input.

**Surfaces:** ClipPreview, TemplatePicker, ClipHistory
**Emits:** `clip.captured`, `clip.normalized`, `intake.object.received`
**Depends on:** `intake-pipeline`

**Extraction ladder (best available wins):**
```
og:* / article:*  →  twitter:*  →  schema.org JSON-LD  →  readability heuristics
```

**Templates:** clipper templates are reusable config (selectors + output markdown
shape). They define what to capture (title, author, published, body, highlights)
and how to render the note — the same template idea your existing clippers use.

**Boundary rule:** the clipper normalizes to markdown + metadata and emits an
intake object; chunking, embedding, and search belong to `document-ingestion` and
`knowledge-index`. Capture once, reuse everywhere.
