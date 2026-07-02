# knowledge-index · sharp edges

## 1. Embedding model swap = full reindex
Mixing `text-embedding-3-small` (1536-dim) + `bge-large-en` (1024-dim) in one Vectorize index = silent garbage at query. Store `EMBED_MODEL` + `EMBED_DIM` per index; reject inserts that don't match. Switching models requires parallel index until cutover.

## 2. `document.chunk.created` flood vs Vectorize batch limits
Bulk PDF imports fire hundreds of events/sec; Vectorize caps at 1000 vectors/request. Batch on a 100ms window via `setImmediate` — never embed-per-event.

## 3. Citation drift on re-ingest
Re-ingesting changes chunk IDs but assistants cache the old IDs in chat history. `DELETE /api/knowledge/document/:documentId` must emit `knowledge.chunks.invalidated` so consumers evict citations.

## 4. Query needs both Vectorize AND D1
Vectorize stores vectors; D1 stores chunk text. If D1 is down but Vectorize succeeds, the result is topK chunkIds with no text. Health check both.
