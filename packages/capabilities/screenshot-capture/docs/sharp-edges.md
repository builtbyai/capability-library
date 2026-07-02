# screenshot-capture · sharp edges

## 1. Playwright cold-start is 1-3 seconds — pool browser instances

A naive `chromium.launch()` per request adds 1-3s of overhead. Maintain a pool (size 2 by default) and recycle pages, not whole browsers. The first capture after idle still pays the launch cost; surface a `cold_start_ms` field on the response so the dashboard knows whether to retry.

## 2. `mcp__chrome-devtools__take_screenshot` does NOT include the URL bar / chrome

The bytes are the page viewport only. If the consumer expects a screenshot that includes the address bar (e.g. for verifying redirect behavior), use `fromDesktop` against the Chrome window region instead.

## 3. Sensitive content in screenshots — strip cookies/JWT/PII before storing

Per the user's `claude-in-chrome` redactor pattern, screenshots of authenticated pages can leak session tokens, addresses, and DOB. Run a redaction pass (OCR + regex blocklist) BEFORE writing to the intake-pipeline CAS store. Once it's content-addressable, it's effectively immutable — you cannot redact retroactively.

## 4. Region coordinates differ across DPI scales

On Windows with display scaling at 150%, a `fromRegion({width: 1000})` captures 1500 actual pixels. The desktop adapter must normalize to physical pixels and stamp `dpiScale` on the record so the consumer can interpret correctly.

## 5. Concurrent desktop captures can deadlock the GDI lock

Windows GDI screenshot APIs serialize globally. Two `fromDesktop` calls in parallel will queue, not run concurrently. Don't promise low p99 latency under load; bound concurrency at 1 for desktop captures.
