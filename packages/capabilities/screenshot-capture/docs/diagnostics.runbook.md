# screenshot-capture · diagnostics runbook

## Rung 1 — playwright present

```bash
node -e "console.log(require('playwright').chromium.executablePath())"
```

Expect a path. Failure = `npx playwright install chromium`.

## Rung 2 — screenshot dir writable

`SCREENSHOT_DIR` exists + writable. Default `~/screenshots/cas/`. ENOSPC kills captures silently — surface remaining-bytes in `_metrics`.

## Rung 3 — smoke

```bash
curl -X POST http://127.0.0.1:5106/api/screenshot/url -d '{"url":"https://example.com"}'
```

Expect 200 + `{ screenshotId, bytes > 1000, contentHash }`.

## Symptom → cause

| Symptom | Cause |
|---|---|
| `nav_timeout` on a known-good URL | Playwright was launched without `--no-sandbox` on Linux/CI; or the headless Chromium has no network in the container. |
| Screenshot bytes = 0 | Page returned before paint. Pass `waitFor: 'networkidle'`. |
| DPI looks wrong | Desktop adapter didn't normalize. Sharp-edges #4. |
| Captures contain secrets | Redaction pass skipped. Sharp-edges #3 — must be applied BEFORE CAS write. |
