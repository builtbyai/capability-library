# @multimarcdown/bulk-media-import

End-to-end bulk media import pipeline: source S3-compatible bucket → Cloudflare R2 + D1.

**Proven: 2549 files (362 MB) imported in under 2 minutes** (2026-06-22 RoofLink → ImpactIQ migration). 41 files/sec sustained, 28x faster than `wrangler r2 object put`.

## Install

```bash
npm install @multimarcdown/bulk-media-import
# peer: wrangler must be globally installed and authenticated
npm install -g wrangler && wrangler login
```

## Quickstart (5 stages)

### 1. Scrape the source app (browser)

Open the source app in Chrome, sign in, open DevTools console, paste:

```js
// paste scripts/scrape_helpers.js, then:
await window.__runBatch([4187593, 4179580, 3902167 /* source-app job ids */]);
window.__downloadBundle('rooflink_bundle.json');
```

The bundle JSON lands in your Downloads folder. (Chrome may ask permission for multi-download — allow.)

### 2. Process bundle → disk

```bash
export WORKER_DIR=/path/to/your/worker
export D1_NAME=impactiq-db
bulk-media-process-bundle ~/Downloads/rooflink_bundle.json ./files
# parallel curl of public photo URLs, base64-decode embedded docs, write to ./files/
```

### 3. Upload to R2 + INSERT D1

```bash
# Generate a throw-away R2 API token at https://dash.cloudflare.com/<account_id>/r2/api-tokens
# Permission: Object Read & Write. Scope: your bucket. TTL: 1 hour.
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_ACCOUNT_ID=ca20e7f2c7c07e1d8b9711bf781551f8
export R2_BUCKET=impactiq-uploads
bulk-media-fast-upload ./files
# ~40 files/sec; chunks D1 INSERT into 200-row batches
```

### 4. Verify

```bash
# Confirm all prereqs before any run
node scripts/verify.mjs
```

## Architecture

See `docs/architecture.md` for the 5-stage decomposition.

```
Browser scrape (Stage 1)
  ↓ Blob download (Stage 2)
Disk extract via parallel curl + b64 (Stage 3)
  ↓ {leadId}_{p|d}{rl_id}_{name}.{ext}
AWS SDK R2 PUT (Stage 4, 32-parallel)
  ↓ leads/{leadId}/{uuid}-{name}.{ext}
Chunked D1 INSERT via wrangler (Stage 5)
```

## Sharp edges

See `docs/sharp-edges.md`. Top three:

1. **Source-app `window.fetch` wrapper crashes on cross-origin S3.** Use `XMLHttpRequest` with `responseType='arraybuffer'`.
2. **Field name typo silently writes HTML.** RoofLink: `p.preview_url` (with underscore), not `p.preview`. Always byte-sniff the result.
3. **R2 S3 credentials ≠ wrangler OAuth.** Generate dedicated R2 API token in CF dashboard. TTL 1hr for one-shot imports.

## Adapting to other sources

`scrape_helpers.js` has a `SOURCE_CONFIG` block at the top — change `apiBase`, `authHeader`, `extractPhoto`, etc. for your source app. Everything downstream (Stages 3–5) is source-agnostic.

`process_bundle.mjs` defaults to RoofLink's `storm_leads.rooflink_job_id` for the lead_id lookup. Override with `--lookup-sql "SELECT id, your_source_id FROM your_leads_table WHERE your_source_id IN (...)"`.

## Cross-platform

Tested: Windows (Git Bash, PowerShell), Linux, macOS. All paths normalize via Node's `path` module. R2 keys are always forward-slash regardless of host OS.

## Reference run

68 storm_leads, 2549 lead_files, 362 MB R2, 0 failures — 2026-06-22. Full audit at `C:/tmp/rl_skill/` on the machine where the run happened.
