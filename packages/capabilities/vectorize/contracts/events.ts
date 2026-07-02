/**
 * vectorize contracts. Generic embedding port for arbitrary text/image inputs —
 * no RAG-specific scaffolding. Backs similarity search, dedup, clustering and
 * recommendation; pluggable embedder via ModelInvocation (local Ollama or hosted).
 */
import { z } from 'zod';

export const VecInputKindSchema = z.enum(['text', 'image']);
export type VecInputKind = z.infer<typeof VecInputKindSchema>;

export const VecEmbeddedEvent = z.object({
  event: z.literal('vec.embedded'),
  embeddingId: z.string().uuid(),
  model: z.string(),
  inputKind: VecInputKindSchema,
  inputHash: z.string(),
  dimensions: z.number().int().positive(),
  tokenCount: z.number().int().nonnegative().optional(),
  wallMs: z.number().int().nonnegative(),
  costUSD: z.number().nonnegative().optional(),
  at: z.string().datetime(),
});
export type VecEmbedded = z.infer<typeof VecEmbeddedEvent>;

export const VecEmbedFailedEvent = z.object({
  event: z.literal('vec.embed.failed'),
  model: z.string(),
  inputKind: VecInputKindSchema,
  inputHash: z.string().optional(),
  reason: z.enum(['model_unavailable', 'input_too_large', 'rate_limited', 'auth_failed', 'parse_error', 'timeout']),
  detail: z.string().optional(),
  retryable: z.boolean(),
  at: z.string().datetime(),
});
export type VecEmbedFailed = z.infer<typeof VecEmbedFailedEvent>;

export const VecClusterCompletedEvent = z.object({
  event: z.literal('vec.cluster.completed'),
  clusterRunId: z.string().uuid(),
  algorithm: z.enum(['kmeans', 'hdbscan', 'agglomerative']),
  inputCount: z.number().int().nonnegative(),
  clusterCount: z.number().int().nonnegative(),
  wallMs: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type VecClusterCompleted = z.infer<typeof VecClusterCompletedEvent>;

export const EVENT_NAMES = {
  embedded: 'vec.embedded',
  embedFailed: 'vec.embed.failed',
  clusterCompleted: 'vec.cluster.completed',
} as const;
