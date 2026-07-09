# bulk-media-import architecture

5-stage pipeline. Stages are independent; you can run any one in isolation.

```
┌────────────────────────┐    ┌────────────────────────┐   ┌────────────────────────┐
│ Stage 1: scrape       │    │ Stage 2: download      │   │ Stage 3: extract       │
│ scrape_helpers.js     │───▶│ Blob → user Downloads  │──▶│ process_bundle.mjs     │
│ (in source-app tab)   │    │ (Chrome multi-dl pill) │   │ (curl photos, b64 docs)│
└────────────────────────┘    └────────────────────────┘   └────────────┬───────────┘
                                                                       │
                                                                       ▼
                                                             {files_dir}/ ready
                                                                       │
                                                                       ▼
                                                          ┌────────────────────────┐
                                                          │ Stage 4 + 5: upload    │
                                                          │ fast_upload.mjs        │
                                                          │ R2 puts (32-parallel)  │
                                                          │ + chunked D1 INSERT    │
                                                          └────────────────────────┘
```

## Why split this way

- **Stage 1 runs in the source app's browser tab** because the source app is the only place with valid session credentials. The token never leaves the user's Chrome.
- **Stage 2 is the user's Downloads folder** so credentials and bytes are inspectable on disk before anything mutates production.
- **Stage 3 (curl + b64 decode) is parallel HTTP** — fastest path for public S3 URLs. Bypasses the source-app browser session entirely.
- **Stage 4 (R2 upload) uses the AWS SDK** with R2's S3-compatible endpoint. The `wrangler r2 object put` CLI spends ~1.5s per call on node startup + wrangler init; direct AWS SDK keeps one connection pool open. Measured ~28x speedup (41 files/sec vs 1.5 files/sec).
- **Stage 5 (D1 INSERT) stays on wrangler** because the bottleneck there is not CLI overhead — D1 batches up to ~200 statements per call, and each batch lands in ~250 ms. No reason to add another auth surface (CF API token) just to skip wrangler here.

## Auth surfaces

| Stage | Auth | Where credentials live |
|-------|------|----------------------|
| 1     | source-app session token | source app's `localStorage` (browser memory) |
| 2     | n/a | Chrome download permission for source domain |
| 3     | none (public URLs) OR same as Stage 1 if signed | n/a |
| 4     | R2 S3-compatible API token | env vars (`R2_*`) |
| 5     | wrangler OAuth token | `~/.wrangler/config/default.toml` |

The R2 token in Stage 4 is the only credential the pipeline asks the user to generate. Give it a 1-hour TTL and revoke after.

## Why not skip wrangler entirely for D1 too

The wrangler OAuth token doesn't include an explicit `d1:write` scope in the standard set, but `workers_scripts:write` covers it via the same token wrangler already has. Generating an additional CF API token with `D1:Edit` permission is doable but adds another surface for no measured benefit (D1 batch INSERTs are already fast).

## Cross-platform notes

| OS | Caveat |
|---|---|
| Windows (Git Bash) | curl is bundled; `execSync` works. Paths use forward slashes everywhere in this code (R2 keys MUST be forward-slash; local paths normalize). |
| Windows (PowerShell) | wrangler is a `.cmd` shim — `execFileSync('wrangler', ...)` ENOENTs. Always use `execSync('wrangler ...', {stdio:'pipe'})` which goes through the shell. |
| Linux / macOS | First-class. Faster overall because no Windows process-spawn tax. |

## File naming protocol (Stage 3 → Stage 4 handoff)

```
{leadId}_{p|d}{sourceId}_{baseName}.{ext}
```

Both Stage 3 (writer) and Stage 4 (parser) depend on this format. If you change it, change both.
