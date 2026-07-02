# tools/digest-renderer

One-shot markdown → (desktop HTML A4 + mobile HTML email-safe) renderer. Standalone CLI version of the `session-digest` capability's render step; useful for one-offs.

## Run

```bash
node tools/digest-renderer/render.mjs --in input.md --out-dir out/
node tools/digest-renderer/render.mjs --in input.md --brand impactiq
```

## Brands

- `ward-tech-systems` (default): gold `#A0752C` on black
- `impactiq`: gold `#DEB568` on black (the Storm-Gold palette)
- `onlyjalen`: red `#FF4D4F` on near-black
- `generic`: blue on white

## What it ships

- Email-safe inline CSS (no flexbox/grid/media-queries/web-fonts) — works in Gmail, Outlook, Apple Mail
- A4 print CSS in the desktop variant
- Minimal HTML; no JS; no external assets

When you need richer features (templates, brand assets from connector-config, multi-source ingestion), use the `session-digest` capability instead.
