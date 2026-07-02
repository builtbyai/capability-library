/**
 * media-processing contracts — variants with provenance, NEVER overwrite the
 * original. Apply/rollback uses DryRunTransaction from @multimarcdown/core.
 */
import { z } from 'zod';

export const MediaAsset = z.object({
  assetId: z.string(),
  originalUri: z.string(),
  mimeType: z.string(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  bytes: z.number().int().nonnegative(),
  hash: z.string(),
  createdAt: z.string(),
});
export type MediaAsset = z.infer<typeof MediaAsset>;

export const MediaVariant = z.object({
  variantId: z.string(),
  assetId: z.string(),
  operation: z.enum(['upscale', 'denoise', 'compress', 'format-convert']),
  provider: z.string(),
  providerJobId: z.string().optional(),
  outputUri: z.string(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  bytes: z.number().int().nonnegative(),
  costUSD: z.number().nonnegative().optional(),
  createdAt: z.string(),
});
export type MediaVariant = z.infer<typeof MediaVariant>;

export const MediaUploadedEvent          = z.object({ event: z.literal('media.uploaded'), asset: MediaAsset, at: z.string() });
export const MediaProcessingStartedEvent = z.object({ event: z.literal('media.processing.started'), assetId: z.string(), operation: z.string(), provider: z.string(), at: z.string() });
export const MediaVariantCreatedEvent    = z.object({ event: z.literal('media.variant.created'), variant: MediaVariant, at: z.string() });
export const MediaProcessingFailedEvent  = z.object({ event: z.literal('media.processing.failed'), assetId: z.string(), operation: z.string(), error: z.string(), at: z.string() });
export const MediaVariantRolledBackEvent = z.object({ event: z.literal('media.variant.rolled-back'), variantId: z.string(), at: z.string() });

export const EVENT_NAMES = {
  uploaded: 'media.uploaded',
  processingStarted: 'media.processing.started',
  variantCreated: 'media.variant.created',
  processingFailed: 'media.processing.failed',
  variantRolledBack: 'media.variant.rolled-back',
} as const;

export interface MediaProcessingPort {
  upload(input: { stream: AsyncIterable<Uint8Array>; mimeType: string }): Promise<MediaAsset>;
  upscale(assetId: string, opts?: { scale?: number; model?: string }): Promise<{ variantId: string }>;
  transcode(assetId: string, opts: { targetMime: string }): Promise<{ variantId: string }>;
  rollback(variantId: string): Promise<void>;
  listVariants(assetId: string): Promise<MediaVariant[]>;
}
