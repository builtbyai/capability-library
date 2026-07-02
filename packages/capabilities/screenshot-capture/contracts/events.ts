/**
 * screenshot-capture contracts. Emits a screenshot record + hands the PNG bytes
 * to intake-pipeline so the same downstream pipeline (document-ingestion for OCR,
 * knowledge-index for visual-similarity search if/when CLIP embeddings land)
 * handles them.
 */
import { z } from 'zod';

export const ScreenshotSourceSchema = z.enum(['browser-url', 'desktop-region', 'desktop-fullscreen', 'browser-mcp']);
export type ScreenshotSource = z.infer<typeof ScreenshotSourceSchema>;

export const ScreenshotRecordSchema = z.object({
  screenshotId: z.string().uuid(),
  source: ScreenshotSourceSchema,
  sourceUrl: z.string().url().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.string().datetime(),
  intakeObjectId: z.string().uuid().optional(),
});
export type ScreenshotRecord = z.infer<typeof ScreenshotRecordSchema>;

export const ScreenshotCapturedEvent  = z.object({ event: z.literal('screenshot.captured'), record: ScreenshotRecordSchema });
export const ScreenshotNormalizedEvent = z.object({ event: z.literal('screenshot.normalized'), screenshotId: z.string().uuid(), intakeObjectId: z.string().uuid() });
export const ScreenshotFailedEvent    = z.object({
  event: z.literal('screenshot.failed'),
  source: ScreenshotSourceSchema,
  reason: z.enum(['nav_timeout', 'permission_denied', 'too_large', 'invalid_region', 'browser_crashed']),
  detail: z.string().optional(),
});

export const EVENT_NAMES = {
  captured: 'screenshot.captured',
  normalized: 'screenshot.normalized',
  failed: 'screenshot.failed',
} as const;

export interface ScreenshotCapturePort {
  fromUrl(input: { url: string; waitFor?: string; viewport?: { width: number; height: number } }): Promise<ScreenshotRecord>;
  fromDesktop(input: { display?: number }): Promise<ScreenshotRecord>;
  fromRegion(input: { x: number; y: number; width: number; height: number }): Promise<ScreenshotRecord>;
}
