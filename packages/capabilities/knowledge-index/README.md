# knowledge-index  ·  _planned_

Reusable RAG over canonical chunks from **any** source. Embeddings, vector index,
retrieval, citations.

**Surfaces:** KnowledgeSearchBox, SourceCitationPanel, ChunkViewer, RAGDebugInspector, IndexStatusCard
**Emits:** `knowledge.chunk.created`, `knowledge.chunk.embedded`, `knowledge.index.updated`, `knowledge.query.received`, `knowledge.sources.retrieved`
**Depends on:** `document-ingestion` (consumes its `DocumentChunk`)
**Adapters:** cloudflare-vectorize · sqlite-fts · external-vector-db (later)

**Boundary rule:**
```
document-ingestion creates canonical chunks
knowledge-index indexes + retrieves canonical chunks
the assistant layer answers using retrieved chunks
```
Do not make RAG PDF-specific; it ingests chunks regardless of origin.
