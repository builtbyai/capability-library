/**
 * knowledge-index contracts. Consumes ChunkBase from @multimarcdown/core
 * (no cross-capability import from document-ingestion).
 */
import { z } from 'zod';
import { ChunkBaseSchema } from '@multimarcdown/core';

export const RetrievedSourceSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  score: z.number(),
  text: z.string(),
  meta: z.record(z.unknown()).default({}),
});
export type RetrievedSource = z.infer<typeof RetrievedSourceSchema>;

export const KnowledgeChunkCreatedSchema     = ChunkBaseSchema;
export const KnowledgeChunkEmbeddedSchema    = z.object({ chunkId: z.string(), vectorDim: z.number(), tookMs: z.number() });
export const KnowledgeChunkEmbedFailedSchema = z.object({ chunkId: z.string(), error: z.object({ code: z.string(), message: z.string() }) });
export const KnowledgeIndexUpdatedSchema     = z.object({ vectors: z.number(), addedSinceLast: z.number(), at: z.string() });
export const KnowledgeQueryReceivedSchema    = z.object({ queryId: z.string(), q: z.string(), topK: z.number() });
export const KnowledgeSourcesRetrievedSchema = z.object({ queryId: z.string(), sources: z.array(RetrievedSourceSchema), tookMs: z.number() });
export const KnowledgeReindexStartedSchema   = z.object({ runId: z.string(), reason: z.enum(['manual', 'scheduled', 'model-upgrade']) });
export const KnowledgeReindexCompletedSchema = z.object({ runId: z.string(), chunks: z.number(), durationMs: z.number() });

export const EVENT_NAMES = {
  chunkCreated:     'knowledge.chunk.created',
  chunkEmbedded:    'knowledge.chunk.embedded',
  chunkEmbedFailed: 'knowledge.chunk.embed.failed',
  indexUpdated:     'knowledge.index.updated',
  queryReceived:    'knowledge.query.received',
  sourcesRetrieved: 'knowledge.sources.retrieved',
  reindexStarted:   'knowledge.reindex.started',
  reindexCompleted: 'knowledge.reindex.completed',
} as const;

export interface VectorIndexPort {
  upsert(chunks: Array<{ chunkId: string; vector: number[]; meta: Record<string, unknown> }>): Promise<void>;
  query(input: { vector: number[]; topK: number; filter?: Record<string, unknown> }): Promise<RetrievedSource[]>;
  delete(predicate: { chunkId?: string; documentId?: string }): Promise<void>;
  status(): Promise<{ vectors: number; dim: number; embedModel: string; indexReady: boolean }>;
}
