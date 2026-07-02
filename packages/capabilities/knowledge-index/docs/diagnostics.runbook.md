# knowledge-index · diagnostics runbook

## Rung 1 — index status
`GET /api/knowledge/index-status` → `{ vectors, dim, embedModel, indexReady }`. `vectors == 0` after a known-good ingest = embedder failed silently. Check `knowledge.chunk.embed.failed` events.

## Rung 2 — embed probe
`POST /api/knowledge/_probe-embed` → asserts dim == `EMBED_DIM`. Mismatch = config drift between embedder and index.

## Rung 3 — query roundtrip
`POST /api/knowledge/query {q:'health-check', topK:3}` → expects sources with text. Empty text + non-empty chunkIds = D1 unreachable (sharp-edges #4).

## Symptom → cause
| Symptom | Cause |
|---|---|
| Queries return empty | Embed model didn't fire. Check failed-embed events. |
| Wrong content returned | Embed-model mismatch (sharp-edges #1). |
| Citations point at deleted chunks | Re-ingest changed IDs (sharp-edges #3). |
