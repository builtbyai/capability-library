# vectorize · sharp edges

## 1. Model swap invalidates all stored vectors

text-embedding-3-small (1536-dim) != bge-large-en (1024-dim). Stored vectors are model-specific; tag every vector with `model` + `dim` at insert time. Knowledge-index has the same sharp edge; both capabilities share the rule.

## 2. Local Ollama embedder is 10x slower than hosted for short texts

OpenAI embeds 1k tokens in ~50ms; local BGE on node-c Tahiti takes 500ms+. For batch jobs, use local; for interactive search, hosted is worth the $0.0001/query.

## 3. Cosine similarity threshold tuning is corpus-dependent

0.85 for English text similarity works as a rough default; for code snippets it's 0.92+; for cross-language pairs it's 0.70. The "similar" endpoint MUST accept threshold as a param, never hard-code.

## 4. Image embeddings + text embeddings cannot mix

CLIP gives you both in the same space; sentence-transformers + image-embed give you different spaces. The port must reject `similar(textVec, imageVec)` queries at the schema layer unless explicitly using a multi-modal model.

## 5. Dedup is O(N²) without an index

Naive pairwise dedup of 10k vectors is 50M comparisons. Use HNSW (in-memory) or Vectorize-style ANN at the storage layer for any corpus > 1k.

