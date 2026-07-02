/**
 * web-clipper contracts. Web-clipper produces markdown + emits clip.normalized
 * { intakeObjectId } after calling IntakePort.ingestUpload(). It does NOT emit
 * intake.object.received — intake owns that event.
 */
import { z } from 'zod';

export const ClipExtractor = z.enum(['og', 'twitter', 'schema-org', 'readability', 'headless-dom']);
export type ClipExtractor = z.infer<typeof ClipExtractor>;

export const ClipTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  domainGlobs: z.array(z.string()).default([]),
  fields: z.record(z.string()),
  noteTemplate: z.string(),
});
export type ClipTemplate = z.infer<typeof ClipTemplateSchema>;

export const CapturedClipSchema = z.object({
  clipId: z.string().uuid(),
  url: z.string().url(),
  finalUrl: z.string().url(),
  title: z.string(),
  author: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  markdown: z.string(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  extractor: ClipExtractor,
  templateId: z.string().optional(),
  capturedAt: z.string().datetime(),
});
export type CapturedClip = z.infer<typeof CapturedClipSchema>;

export const ClipCaptured = z.object({ event: z.literal('clip.captured'), clip: CapturedClipSchema });
export const ClipNormalized = z.object({ event: z.literal('clip.normalized'), clipId: z.string().uuid(), intakeObjectId: z.string().uuid() });
export const ClipFailed = z.object({
  event: z.literal('clip.failed'),
  url: z.string().url(),
  reason: z.enum(['fetch_failed', 'rate_limited', 'too_large', 'blocked', 'extraction_empty', 'spa_no_headless']),
  status: z.number().int().optional(),
  detail: z.string().optional(),
});

export const EVENT_NAMES = {
  captured: 'clip.captured',
  normalized: 'clip.normalized',
  failed: 'clip.failed',
} as const;

export interface WebClipperPort {
  listTemplates(): Promise<ClipTemplate[]>;
  upsertTemplate(t: ClipTemplate): Promise<ClipTemplate>;
  clip(input: { url: string; templateId?: string }): Promise<CapturedClip>;
}
