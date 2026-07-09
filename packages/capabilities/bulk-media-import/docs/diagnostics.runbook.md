# diagnostics.runbook.md — bulk-media-import

What to check when a run fails. Map symptom → likely cause → command to verify.

## Symptom: "all photos are HTML pages" / file sizes all 2546 bytes

```bash
# byte-sniff every photo in a dir; expects all to be JPEG/PNG
for f in {files_dir}/*; do head -c 4 "$f" | od -An -tx1 | tr -d ' '; done | sort | uniq -c | sort -rn
# expected: many 'ffd8ffe0' (JPEG) and/or '89504e47' (PNG)
# bad: '3c21646f' (= '<!do' = HTML doctype)
```

If you see HTML magic bytes, one of:
1. Stage 1 used the wrong field name (`p.preview` instead of `p.preview_url`) → see sharp-edges #2
2. Stage 1 used `fetch` instead of XHR and hit the analytics wrapper bug → see sharp-edges #1
3. The source app rotated its auth token mid-scrape → re-run Stage 1

## Symptom: `fast_upload.mjs` reports `ENOENT` or `spawnSync wrangler ENOENT`

On Windows. Cause is `execFileSync('wrangler', ...)` not finding the `.cmd` shim. All scripts in this module use `execSync` — confirm you're running the module's scripts, not a forked copy.

## Symptom: R2 uploads succeed but downstream worker still shows broken images

```bash
# probe the actual R2 object via wrangler (uses your local OAuth — bypasses worker proxy)
wrangler r2 object get impactiq-uploads/leads/{leadId}/{r2_key_tail} --remote --file /tmp/probe.bin
file /tmp/probe.bin
# expected: JPEG image data / PNG image data / PDF document
# bad: HTML document
```

If R2 has HTML, the upload itself ingested HTML — see "all photos are HTML pages" above. The fix is to re-do Stage 1 + 3, then re-run Stage 4.

If R2 has the correct bytes but the worker proxy returns HTML, check the worker's `/api/image/proxy/<key>` implementation — it might be returning an SPA fallback for "not found" with HTTP 200. Common Cloudflare Pages misconfig.

## Symptom: D1 INSERT chunk fails with `UNIQUE constraint failed: storm_leads.rooflink_job_id`

Job is already imported. Either:
- skip the duplicate IDs via `SKIP_JOB_IDS=...` and re-run, OR
- decide between INSERT vs UPDATE for the conflicting row

`wrangler d1 execute` is transactional per file — one violation rolls back the whole chunk. Identify conflicts:

```bash
wrangler d1 execute impactiq-db --remote --json \
  --command "SELECT rooflink_job_id, id FROM storm_leads WHERE rooflink_job_id IN ($(cat C:/tmp/rl_skill/insert_ids.txt))"
```

## Symptom: Stage 1 browser scrape progresses 1 job per 30 sec

Tab is throttled. Run:

```js
// in source-app tab console:
document.visibilityState     // 'hidden' = throttled
```

Foreground or pop into own window. See sharp-edges #3.

## Symptom: monitor of background processor never fires DONE

Windows pipe buffering. `tail -F` on the output file shows zero bytes during the run, then a flush at the end. The processor IS running; only stdout is buffered. Check via:

```bash
ls {files_dir} | wc -l   # disk file count grows during Stage 3
# OR D1 count grows during Stage 5:
wrangler d1 execute impactiq-db --remote --json --command "SELECT COUNT(*) FROM lead_files WHERE created_at > datetime('now','-10 minutes')"
```

## Symptom: AWS SDK PutObject returns `403 SignatureDoesNotMatch`

R2 token mismatch. Possible causes:
- Wrong `R2_ACCOUNT_ID` (different from CF account where the bucket lives)
- Token scoped to a different bucket
- Token expired (TTL)
- Pasted wrong key/secret (whitespace, line break)

Verify with `verify.mjs` — it runs `HeadBucketCommand` which fails with the same error if any of the above is wrong:

```bash
R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_ACCOUNT_ID=... R2_BUCKET=... \
  node scripts/verify.mjs
```

## Symptom: Stage 3 curl gives `403 Forbidden` for some photos

Source app's S3 URL is signed and the signature expired. Re-do Stage 1 to refresh URLs, OR add the source-app session and refetch via `__xhrBytes`.

## Visual verify in production UI

After Stage 5 lands, hit the canonical URL:

```
https://<your-app>/app/customer/<leadId>
```

Expect:
- header populated
- contact info populated
- photo gallery strip rendering at the bottom
- 0 console errors

Per CLAUDE.md: do not declare done without a screenshot or live render confirmation.
