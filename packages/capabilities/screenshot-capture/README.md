# screenshot-capture · _planned_

Browser tab (Chrome DevTools MCP / Playwright) or desktop screenshot capture, normalized through intake-pipeline.

**Surfaces:** ScreenshotButton, ScreenshotPreview, RegionPicker, ScreenshotHistory
**Emits:** `screenshot.captured`, `screenshot.normalized`, `screenshot.failed`
**Depends on:** intake-pipeline

## Why a capability, not a tool

A one-off screenshot script is just a tool. This capability exists because the user actually captures hundreds per week across chrome-fleet, css-error-extractor, browser-debug, and webapp-testing skills — and they ALL want to:
1. Persist the PNG to a known location
2. Hash it for dedup
3. Feed it into intake-pipeline so document-ingestion can OCR text out of it later
4. Show the user a thumbnail preview

Centralizing means each consumer skill stops reinventing the buffer-to-disk-to-OCR pipeline.

## Browser vs desktop

- `fromUrl`: Playwright drives a headless Chromium. Use when source is a URL.
- `fromMcp`: existing Chrome DevTools MCP tab. Use when you already have an authenticated session (ImpactIQ, etc.).
- `fromDesktop` / `fromRegion`: native screen capture. Use for native UI debugging, not browser content.
