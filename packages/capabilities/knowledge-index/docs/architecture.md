# knowledge-index · architecture

Subscribes to `document.chunk.created` from document-ingestion. Embeds in batches (Vectorize accepts max 1000 vectors/request) and upserts into the configured VectorIndexPort. Query path: embed query → `topK` vector search → resolve chunk text from D1 by chunkId → return as `RetrievedSource[]`.

Provider via `connector-config` (default: cloudflare-vectorize). Per index: `(embedModel, embedDim)` stored as metadata; mismatched inserts rejected. Reindex jobs swap to a parallel index, then atomic alias.
