/**
 * @multimarcdown/adapter-cloudflare-vectorize — Vectorize implementation of the knowledge-index vector-store port.
 *
 * Upsert + query embeddings against a Cloudflare Vectorize index. The
 * knowledge-index capability owns chunking/citations; this owns the Vectorize
 * binding so the store is swappable (pgvector, Qdrant, …).
 */
export interface VectorizeConfig {
  accountId: string;
  indexName: string;
  apiToken: string;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface VectorizeAdapter {
  upsert(records: VectorRecord[]): Promise<{ count: number }>;
  query(vector: number[], topK: number): Promise<VectorMatch[]>;
}

export function createVectorizeAdapter(_config: VectorizeConfig): VectorizeAdapter {
  throw new Error('adapter-cloudflare-vectorize: not implemented — bind the Vectorize REST/binding API here');
}
