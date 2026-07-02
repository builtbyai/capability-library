/**
 * media-generation contracts. One run = one prompt against one backend
 * (Replicate / DALL-E / SD-local / fal.ai) producing one or more assets that
 * land in intake-pipeline. Events let cost-ledger, content-dashboard, and
 * notify subscribe without coupling to the specific backend driver.
 */
import { z } from 'zod';

export const GenBackendSchema = z.enum(['replicate', 'openai', 'stable-diffusion-local', 'fal']);
export type GenBackend = z.infer<typeof GenBackendSchema>;

export const GenMediaKindSchema = z.enum(['image', 'video', 'upscale']);
export type GenMediaKind = z.infer<typeof GenMediaKindSchema>;

export const GenAssetSchema = z.object({
  assetId: z.string().uuid(),
  runId: z.string().uuid(),
  kind: GenMediaKindSchema,
  /** Where the bytes were staged (file path, R2 key, intake-object ref). */
  storageRef: z.string(),
  /** sha256 of the asset bytes. */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
  mimeType: z.string(),
  /** intake-pipeline object id once staged. */
  intakeObjectId: z.string().uuid().optional(),
});
export type GenAsset = z.infer<typeof GenAssetSchema>;

export const GenRunStartedEvent = z.object({
  event: z.literal('gen.run.started'),
  runId: z.string().uuid(),
  kind: GenMediaKindSchema,
  backend: GenBackendSchema,
  /** Provider-specific model id (e.g. 'stability-ai/sdxl', 'dall-e-3'). */
  model: z.string(),
  prompt: z.string(),
  /** Optional input asset (image-to-image / upscale source). */
  inputAssetRef: z.string().optional(),
  estimatedCostUSD: z.number().nonnegative().optional(),
  at: z.string().datetime(),
});
export type GenRunStarted = z.infer<typeof GenRunStartedEvent>;

export const GenAssetCreatedEvent = z.object({
  event: z.literal('gen.asset.created'),
  asset: GenAssetSchema,
  at: z.string().datetime(),
});
export type GenAssetCreated = z.infer<typeof GenAssetCreatedEvent>;

export const GenRunCompletedEvent = z.object({
  event: z.literal('gen.run.completed'),
  runId: z.string().uuid(),
  assetIds: z.array(z.string().uuid()),
  costUSD: z.number().nonnegative(),
  wallMs: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type GenRunCompleted = z.infer<typeof GenRunCompletedEvent>;

export const GenRunFailedEvent = z.object({
  event: z.literal('gen.run.failed'),
  runId: z.string().uuid(),
  backend: GenBackendSchema,
  reason: z.enum([
    'budget-exceeded',
    'provider-error',
    'content-policy',
    'timeout',
    'invalid-input',
    'unknown',
  ]),
  error: z.string(),
  costUSD: z.number().nonnegative().default(0),
  at: z.string().datetime(),
});
export type GenRunFailed = z.infer<typeof GenRunFailedEvent>;

export const GenRunRefundedEvent = z.object({
  event: z.literal('gen.run.refunded'),
  runId: z.string().uuid(),
  /** Amount the provider refunded back; subtracted from cost-ledger. */
  refundUSD: z.number().nonnegative(),
  reason: z.string(),
  at: z.string().datetime(),
});
export type GenRunRefunded = z.infer<typeof GenRunRefundedEvent>;

export const EVENT_NAMES = {
  runStarted: 'gen.run.started',
  assetCreated: 'gen.asset.created',
  runCompleted: 'gen.run.completed',
  runFailed: 'gen.run.failed',
  runRefunded: 'gen.run.refunded',
} as const;
