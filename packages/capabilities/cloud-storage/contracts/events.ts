/**
 * cloud-storage contracts. Google-Drive-style port over Cloudflare R2: object
 * lifecycle (uploaded/deleted/restored), share-link issuance, scheduled sync
 * runs, and quota warnings. Emitted to the bus so notify + content-dashboard
 * can subscribe without coupling to the storage layer.
 */
import { z } from 'zod';

export const CloudObjectRefSchema = z.object({
  bucket: z.string(),
  key: z.string(),
  /** Folder path layered on top of R2's flat keyspace, '/' separator. */
  folder: z.string().optional(),
  bytes: z.number().int().nonnegative(),
  contentType: z.string().optional(),
  /** sha256 of the object bytes when computed. */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
export type CloudObjectRef = z.infer<typeof CloudObjectRefSchema>;

export const CloudObjectUploadedEvent = z.object({
  event: z.literal('cloud.object.uploaded'),
  object: CloudObjectRefSchema,
  source: z.enum(['ui-upload', 'scheduled-sync', 'api', 'bulk-media-import']),
  at: z.string().datetime(),
});
export type CloudObjectUploaded = z.infer<typeof CloudObjectUploadedEvent>;

export const CloudObjectDeletedEvent = z.object({
  event: z.literal('cloud.object.deleted'),
  object: CloudObjectRefSchema,
  /** True when the delete moved the object to TrashBin rather than purging it. */
  trashed: z.boolean(),
  at: z.string().datetime(),
});
export type CloudObjectDeleted = z.infer<typeof CloudObjectDeletedEvent>;

export const CloudObjectRestoredEvent = z.object({
  event: z.literal('cloud.object.restored'),
  object: CloudObjectRefSchema,
  /** Path the object was restored to (may differ from original). */
  restoredTo: z.string(),
  at: z.string().datetime(),
});
export type CloudObjectRestored = z.infer<typeof CloudObjectRestoredEvent>;

export const CloudShareLinkCreatedEvent = z.object({
  event: z.literal('cloud.share-link.created'),
  shareId: z.string().uuid(),
  object: CloudObjectRefSchema,
  url: z.string().url(),
  /** Optional expiry; null = never expires. */
  expiresAt: z.string().datetime().nullable(),
  /** Whether the link requires the recipient to authenticate. */
  requiresAuth: z.boolean(),
});
export type CloudShareLinkCreated = z.infer<typeof CloudShareLinkCreatedEvent>;

export const CloudSyncRunCompletedEvent = z.object({
  event: z.literal('cloud.sync.run.completed'),
  jobId: z.string().uuid(),
  /** Origin of the sync: a local folder, S3 bucket, Google Drive root, etc. */
  origin: z.string(),
  /** Destination bucket the sync wrote into. */
  bucket: z.string(),
  objectsUploaded: z.number().int().nonnegative(),
  objectsSkipped: z.number().int().nonnegative(),
  objectsFailed: z.number().int().nonnegative(),
  wallMs: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type CloudSyncRunCompleted = z.infer<typeof CloudSyncRunCompletedEvent>;

export const CloudQuotaWarningEvent = z.object({
  event: z.literal('cloud.quota.warning'),
  bucket: z.string(),
  bytesUsed: z.number().int().nonnegative(),
  bytesQuota: z.number().int().nonnegative(),
  /** 0..1, fraction of quota consumed. */
  ratio: z.number().min(0).max(1),
  severity: z.enum(['info', 'warn', 'critical']),
});
export type CloudQuotaWarning = z.infer<typeof CloudQuotaWarningEvent>;

export const EVENT_NAMES = {
  objectUploaded: 'cloud.object.uploaded',
  objectDeleted: 'cloud.object.deleted',
  objectRestored: 'cloud.object.restored',
  shareLinkCreated: 'cloud.share-link.created',
  syncRunCompleted: 'cloud.sync.run.completed',
  quotaWarning: 'cloud.quota.warning',
} as const;
