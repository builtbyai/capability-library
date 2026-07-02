# screenshot-capture · architecture

Three capture paths behind one port:

```
fromUrl(url)        → playwright.chromium → page.screenshot(png)
fromMcp(tab)        → mcp__chrome-devtools__take_screenshot (existing session, no new browser)
fromDesktop()       → native API: Win32 GDI / Quartz / X11
```

All three produce PNG/JPEG bytes. The capability then:

1. `hashStream` → contentHash
2. Write to `SCREENSHOT_DIR/cas/<sha256>.png`
3. Call `IntakePort.ingestUpload({source:'screenshot', sourceMeta:{ source: ..., url: ... }})`
4. Emit `screenshot.captured` then `screenshot.normalized{intakeObjectId}`

Downstream capabilities pick up the intake object via their normal MIME-route subscriptions. document-ingestion handles OCR (image → text); media-processing can generate variants if needed.
