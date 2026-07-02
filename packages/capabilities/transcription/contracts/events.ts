/**
 * transcription contracts. Output chunks extend ChunkBase from @multimarcdown/core
 * so knowledge-index can embed them without a custom adapter.
 */
import { z } from 'zod';
import { ChunkBaseSchema } from '@multimarcdown/core';

export const TranscriptionBackendSchema = z.enum(['whisper-cpp', 'openai-whisper', 'deepgram', 'ollama-whisper']);
export type TranscriptionBackend = z.infer<typeof TranscriptionBackendSchema>;

export const TranscriptSegmentSchema = z.object({
  segmentId: z.string().uuid(),
  jobId: z.string().uuid(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
  speaker: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const TranscriptionJobSchema = z.object({
  jobId: z.string().uuid(),
  intakeObjectId: z.string().uuid(),
  backend: TranscriptionBackendSchema,
  model: z.string(),
  language: z.string().optional(),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  diarize: z.boolean().default(false),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).optional(),
});
export type TranscriptionJob = z.infer<typeof TranscriptionJobSchema>;

/** Chunks emitted to knowledge-index. Token-aware boundaries crossing segments are fine. */
export const TranscriptChunkSchema = ChunkBaseSchema.extend({
  jobId: z.string().uuid(),
  /** Inclusive range over segmentIds — knows which audio time-range backs the chunk. */
  fromSegmentId: z.string().uuid(),
  toSegmentId: z.string().uuid(),
  speakers: z.array(z.string()).default([]),
});

export const TranscriptionRequestedEvent     = z.object({ event: z.literal('transcription.requested'), jobId: z.string().uuid(), intakeObjectId: z.string().uuid(), at: z.string() });
export const TranscriptionStartedEvent       = z.object({ event: z.literal('transcription.started'), jobId: z.string().uuid(), backend: TranscriptionBackendSchema, model: z.string(), at: z.string() });
export const TranscriptionSegmentCreatedEvent= z.object({ event: z.literal('transcription.segment.created'), segment: TranscriptSegmentSchema });
export const TranscriptionCompletedEvent     = z.object({ event: z.literal('transcription.completed'), jobId: z.string().uuid(), durationMs: z.number(), segmentCount: z.number().int() });
export const TranscriptionFailedEvent        = z.object({ event: z.literal('transcription.failed'), jobId: z.string().uuid(), reason: z.string(), retryable: z.boolean() });

export const EVENT_NAMES = {
  requested: 'transcription.requested',
  started: 'transcription.started',
  segmentCreated: 'transcription.segment.created',
  completed: 'transcription.completed',
  failed: 'transcription.failed',
} as const;

export interface TranscriptionPort {
  enqueue(input: { intakeObjectId: string; backend?: TranscriptionBackend; model?: string; language?: string; diarize?: boolean }): Promise<TranscriptionJob>;
  getStatus(jobId: string): Promise<TranscriptionJob>;
  listSegments(jobId: string): Promise<TranscriptSegment[]>;
  relabelSpeaker(jobId: string, oldLabel: string, newLabel: string): Promise<{ updated: number }>;
}
