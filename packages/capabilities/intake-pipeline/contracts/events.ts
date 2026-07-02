/**
 * intake-pipeline contracts — the canonical front-door records.
 *
 * The shared types (IntakeObject, ContentRef) live in @multimarcdown/core so
 * every consumer imports one shape. This file declares the EVENTS this
 * capability emits.
 */
import { z } from 'zod';
import {
  IntakeObjectSchema,
  ContentRefSchema,
  DEFAULT_INTAKE_ROUTES,
} from '@multimarcdown/core';

export const IntakeObjectReceived = z.object({
  event: z.literal('intake.object.received'),
  object: IntakeObjectSchema,
});
export type IntakeObjectReceived = z.infer<typeof IntakeObjectReceived>;

export const IntakeObjectStored = z.object({
  event: z.literal('intake.object.stored'),
  objectId: z.string().uuid(),
  ref: ContentRefSchema,
});
export type IntakeObjectStored = z.infer<typeof IntakeObjectStored>;

export const IntakeObjectRouted = z.object({
  event: z.literal('intake.object.routed'),
  objectId: z.string().uuid(),
  targetCapability: z.string(),
  mimeType: z.string(),
});
export type IntakeObjectRouted = z.infer<typeof IntakeObjectRouted>;

export const IntakeObjectRejected = z.object({
  event: z.literal('intake.object.rejected'),
  objectId: z.string().uuid().optional(),
  reason: z.enum(['too_large', 'mime_blocked', 'hash_dup', 'storage_failed', 'malformed']),
  detail: z.string().optional(),
});
export type IntakeObjectRejected = z.infer<typeof IntakeObjectRejected>;

export const EVENT_NAMES = {
  received: 'intake.object.received',
  stored: 'intake.object.stored',
  routed: 'intake.object.routed',
  rejected: 'intake.object.rejected',
} as const;

export interface IntakePort {
  ingestUpload(input: {
    stream: AsyncIterable<Uint8Array>;
    filename: string;
    mimeType?: string;
    source: string;
    sourceMeta?: Record<string, unknown>;
  }): Promise<import('@multimarcdown/core').IntakeObject>;
  ingestUrl(input: {
    url: string;
    source: string;
    sourceMeta?: Record<string, unknown>;
  }): Promise<import('@multimarcdown/core').IntakeObject>;
  get(objectId: string): Promise<import('@multimarcdown/core').IntakeObject | null>;
  bytes(objectId: string): Promise<AsyncIterable<Uint8Array>>;
}

/** Re-export for back-compat with consumers that imported INTAKE_ROUTES from here. */
export const INTAKE_ROUTES = DEFAULT_INTAKE_ROUTES;
