/**
 * Canonical intake types — owned by the intake-pipeline capability, hoisted to
 * core so every consumer (document-ingestion, media-processing, web-clipper,
 * bulk-media-import, email-connector) imports one shape.
 *
 * Originals are immutable. Downstream capabilities create derived records keyed
 * by `objectId`; they never mutate an IntakeObject.
 */
import { z } from 'zod';

/** Known sources are tagged for autocomplete; the union accepts any string so a
 *  new connector can declare its own source without editing this file. */
export const KnownIntakeSource = z.enum([
  'manual_upload',
  'gmail',
  'imap',
  'folder_watch',
  'url',
  'api',
  'clipboard',
  'bulk_import',
  'web_clip',
]);
export const IntakeSource = z.union([KnownIntakeSource, z.string().min(1)]);

/** A reference to bytes wherever they live — local fs, s3, r2, content-addressable. */
export const ContentRefSchema = z.object({
  scheme: z.enum(['file', 's3', 'r2', 'cas', 'http', 'https']),
  uri: z.string(),
  bytes: z.number().int().nonnegative(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ContentRef = z.infer<typeof ContentRefSchema>;

export const IntakeObjectSchema = z.object({
  objectId: z.string().uuid(),
  source: IntakeSource,
  sourceMeta: z.record(z.unknown()).optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  ref: ContentRefSchema,
  receivedAt: z.string().datetime(),
});
export type IntakeObject = z.infer<typeof IntakeObjectSchema>;

/** MIME -> downstream capability id (default route table; overrideable per deployment). */
export const DEFAULT_INTAKE_ROUTES: Record<string, string> = {
  'application/pdf': 'document-ingestion',
  'image/png': 'media-processing',
  'image/jpeg': 'media-processing',
  'image/webp': 'media-processing',
  'image/gif': 'media-processing',
  'application/vnd.google-earth.kml+xml': 'geo-visualization',
  'application/geo+json': 'geo-visualization',
  'message/rfc822': 'email-connector',
  'text/html': 'web-clipper',
  'text/markdown': 'document-ingestion',
};
