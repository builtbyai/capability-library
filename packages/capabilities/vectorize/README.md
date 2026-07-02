# vectorize · _planned_

Compute embeddings for arbitrary text/image inputs, without the RAG-specific scaffolding of knowledge-index. Used for similarity search, dedup, clustering, recommendation. Pluggable embedder via ModelInvocation; supports local (BGE/E5 via Ollama) and hosted (OpenAI text-embedding-3-small) backends.

**Surfaces:** EmbedPlayground, SimilaritySearchPanel, ClusterViewer, EmbeddingDimChart
**Emits:** `vec.embedded`, `vec.embed.failed`, `vec.cluster.completed`
**Jobs:** `vectorize:embed-batch`, `vectorize:dedup`, `vectorize:cluster`
**Depends on:** gpu-router

See `docs/sharp-edges.md` for project-specific landmines.
