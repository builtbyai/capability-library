/**
 * ChunkBase — the canonical chunk shape every chunk-producing capability
 * (document-ingestion, web-clipper for long markdown, transcription if it ever
 * lands) extends. knowledge-index consumes ChunkBase directly so it doesn't
 * have to cross-import from sibling capabilities.
 */
import { z } from 'zod';

export const ChunkBaseSchema = z.object({
  chunkId: z.string().uuid(),
  /** The IntakeObject this chunk descends from. */
  sourceId: z.string(),
  sourceKind: z.enum(['document', 'clip', 'email', 'transcript']),
  text: z.string(),
  tokenCount: z.number().int().nonnegative(),
  /** Set once the chunk has been embedded; pre-embed chunks have no id. */
  embeddingId: z.string().optional(),
  meta: z.record(z.unknown()).default({}),
});
export type ChunkBase = z.infer<typeof ChunkBaseSchema>;
