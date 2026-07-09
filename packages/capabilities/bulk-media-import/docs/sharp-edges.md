# sharp-edges.md — bulk-media-import

Failure modes that have already cost cycles. Read before extending.

## 1. Source-app `window.fetch` analytics wrapper crashes on opaque S3 responses

Symptom: every photo "downloaded" via Stage 1 returns the same 2546-byte HTML blob — the SPA's `index.html`. Error in the source-app console:
```
TypeError: Cannot read properties of undefined (reading 'clone')
```

Cause: source app monkey-patched `window.fetch` for analytics (RoofLink does this for PostHog / Mixpanel). The wrapper tries to `.clone()` the response for logging but cross-origin opaque responses can't be cloned.

Fix: **use `XMLHttpRequest` with `responseType='arraybuffer'`** instead of `fetch` for byte downloads in the browser. `scrape_helpers.js` does this in `window.__xhrBytes`.

## 2. Field-name typo silently writes HTML instead of image bytes

Symptom: `process_bundle.mjs` reports curl OK for every photo, but the files on disk are all exactly 2546 bytes and `file` reports them as `HTML document, ASCII text`.

Cause: source-app's photo object has `preview_url` (with underscore), not `preview`. If you wrote `p.preview` your URL is `undefined`, you `curl` `<source-app>/undefined`, which hits the SPA's catch-all route and serves the index.html shell with HTTP 200.

Fix in `scrape_helpers.js`:
- ✅ `p.preview_url`
- ❌ `p.preview`

Defense in depth — `process_bundle.mjs` byte-sniffs after curl and throws "not a known image type" if MIME is `application/octet-stream` (HTML pages sniff as octet-stream because they don't match JPEG/PNG/GIF/WebP magic bytes).

## 3. Chrome heavily throttles background tabs

Symptom: Stage 1 scrape is glacial — 1 job per 30 seconds when the math says 1 per 5 seconds.

Cause: Chrome's tab-throttling clamps `setTimeout` to ~1Hz on backgrounded tabs to save battery. The pagination loop in `__scrapeFull` makes ~3 fetches per job; each one waits on the patched fetch wrapper.

Fix: ask the user to **foreground the source-app tab** OR **pop it into its own window** (drag tab off). A dedicated window stays at full speed regardless of focus.

## 4. Chrome blocks multi-downloads

Symptom: Stage 2 download triggers but nothing lands on disk. No error in console.

Cause: after the first download from a domain, Chrome silently blocks subsequent downloads unless the user clicks the address-bar pill to "Allow multiple downloads from <site>".

Fix: tell the user to grant the permission. Single-download workflows (bundle everything into one JSON before the click) avoid this entirely — and we do.

## 5. claude-in-chrome output redactor blocks URLs / cookies / JWTs

Symptom: `mcp__claude-in-chrome__javascript_tool` returns `[BLOCKED: Cookie/query string data]` when you `JSON.stringify(...)` anything with URLs in it.

Cause: the MCP server redacts patterns that look like cookies, query strings, or JWT-shaped tokens to prevent secret exfil.

Fix: for status reads, return only counts / keys / lengths. e.g. `out.length + ':' + out.map(r => r.status).join(',')` works; `JSON.stringify(out)` with full URLs gets blocked.

## 6. R2 S3-compatible token ≠ wrangler OAuth token

Symptom: trying to use the wrangler OAuth token (`cfoat_*` in `~/.wrangler/config/default.toml`) with AWS SDK returns 403.

Cause: those are two completely different auth systems. Wrangler uses OAuth (account-scoped, no R2 access keys). AWS SDK uses HMAC-SHA256 signed requests with R2-issued access key + secret.

Fix: generate a dedicated **R2 API token** at `https://dash.cloudflare.com/<account_id>/r2/api-tokens` → "Object Read & Write" → optionally scope to a single bucket → TTL 1 hour for one-shot imports. The dashboard shows Access Key ID + Secret Access Key ONCE — copy both immediately.

## 7. D1 single-batch INSERT cap

Symptom: `wrangler d1 execute --file big.sql` succeeds for small files but errors with `Request body too large` or times out for files with thousands of INSERTs.

Cause: D1's remote import API has a per-batch limit (empirically ~200-500 statements works, beyond that = flaky).

Fix: chunk INSERTs into batches of 200 (the default `D1_CHUNK_SIZE`). Each chunk is its own `wrangler d1 execute --file` call.

## 8. Storm_leads-specific: column 100 cap, no `SELECT *`

Source CRM `storm_leads` is at 100 columns. D1's result-set cap is ~100. Any `SELECT * FROM storm_leads` will silently truncate. Always enumerate the columns you need. Also, `ALTER TABLE ADD COLUMN` is at risk — put new fields in the existing `metadata` JSON column instead.

## 9. Wrangler `execFileSync` ENOENT on Windows

Symptom: `spawnSync wrangler ENOENT` for every R2 upload.

Cause: on Windows, `wrangler` is a `.cmd` shim, not a `.exe`. `execFileSync('wrangler', ...)` looks up PATH but won't execute `.cmd` files without the shell.

Fix: use `execSync('wrangler r2 object put ...', {shell:true})` (which is the default for `execSync` — but NOT for `execFileSync`). All scripts in this module use `execSync`.

## 10. SQL injection via filename

We string-concat filenames into SQL. `sqlEscape()` doubles single quotes (`'` → `''`) which is correct for SQLite/D1. If you fork this for a non-SQLite target, replace with proper parameterized queries (better-sqlite3 or whatever your driver provides).

## 11. Orphan R2 objects from killed/failed runs

If `fast_upload.mjs` is killed mid-run, you'll have R2 objects with no corresponding `lead_files` row. They're "garbage" but harmless — no UI references them. Sweep with `wrangler r2 object list impactiq-uploads --prefix leads/<lead_id>/` and compare against D1's `r2_key` column to find orphans.
