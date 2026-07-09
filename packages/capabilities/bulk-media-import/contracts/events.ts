/**
 * bulk-media-import contracts. Emits run lifecycle events + (optionally,
 * --emit-intake) one intake.object.received per successful R2 PUT.
 */
import { z } from 'zod';
import { IntakeObjectSchema } from '@multimarcdown/core';

export const BulkImportRunStarted = z.object({
  event: z.literal('bulk-import.run.started'),
  runId: z.string().uuid(),
  source: z.string(),
  expectedFiles: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
});

export const BulkImportFileUploaded = z.object({
  event: z.literal('bulk-import.file.uploaded'),
  runId: z.string().uuid(),
  r2Key: z.string(),
  bytes: z.number().int().positive(),
  mimeType: z.string(),
  sourceFileId: z.union([z.string(), z.number()]),
  leadId: z.union([z.string(), z.number()]),
  intakeObject: IntakeObjectSchema,
});

export const BulkImportRunCompleted = z.object({
  event: z.literal('bulk-import.run.completed'),
  runId: z.string().uuid(),
  ok: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
});

export const BulkImportRunFailed = z.object({
  event: z.literal('bulk-import.run.failed'),
  runId: z.string().uuid(),
  stage: z.enum(['scrape', 'extract', 'upload', 'd1-insert']),
  reason: z.string(),
});

export const EVENT_NAMES = {
  runStarted: 'bulk-import.run.started',
  fileUploaded: 'bulk-import.file.uploaded',
  runCompleted: 'bulk-import.run.completed',
  runFailed: 'bulk-import.run.failed',
} as const;

/** On-disk file naming protocol parsed by fast_upload.mjs. */
export const DISK_NAME_REGEX = /^(?<leadId>\d+)_(?<kind>[pd])(?<sourceId>\d+)_(?<base>.+?)\.(?<ext>[a-z0-9]+)$/i;

/** Bundle shape from the browser-side scraper (cross-validated against bundle.schema.json). */
export const BundlePhoto = z.object({
  id: z.number().int(), n: z.string(), p: z.string().url(),
  o: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  c: z.string().optional(),
});
export const BundleDoc = z.object({
  id: z.number().int(), n: z.string(),
  ext: z.string().nullable().optional(),
  mime: z.string(),
  size: z.number().int().positive(),
  b64: z.string(),
  c: z.string().optional(),
});
export const BundleSchema = z.object({
  exported_at: z.string().datetime().optional(),
  source: z.string().optional(),
  jobs: z.array(z.object({
    job_id: z.number().int(),
    photos: z.array(BundlePhoto),
    docs: z.array(BundleDoc),
    errs: z.array(z.record(z.unknown())).optional(),
  })),
});
export type Bundle = z.infer<typeof BundleSchema>;
