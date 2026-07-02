/**
 * windows-control contracts. UIA semantic clicking + OCR + template-match + window
 * management through the BBWADMIN broker (port 9900, bearer tokens, scope-graded
 * permissions). Events expose action outcomes to dashboards + audit log.
 */
import { z } from 'zod';

export const WctlActionKindSchema = z.enum([
  'screenshot',
  'click',
  'uia-click',
  'type',
  'ocr',
  'template-match',
  'window',
]);
export type WctlActionKind = z.infer<typeof WctlActionKindSchema>;

export const WctlActionCompletedEvent = z.object({
  event: z.literal('wctl.action.completed'),
  actionId: z.string().uuid(),
  kind: WctlActionKindSchema,
  hostId: z.string(),
  scope: z.string(),
  durationMs: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type WctlActionCompleted = z.infer<typeof WctlActionCompletedEvent>;

export const WctlActionDeniedEvent = z.object({
  event: z.literal('wctl.action.denied'),
  actionId: z.string().uuid(),
  kind: WctlActionKindSchema,
  hostId: z.string(),
  requiredScope: z.string(),
  presentedScope: z.string().optional(),
  reason: z.enum(['scope_insufficient', 'token_invalid', 'token_expired', 'host_offline']),
  at: z.string().datetime(),
});
export type WctlActionDenied = z.infer<typeof WctlActionDeniedEvent>;

export const WctlUiaClickMissEvent = z.object({
  event: z.literal('wctl.uia.click.miss'),
  actionId: z.string().uuid(),
  hostId: z.string(),
  selector: z.string(),
  reason: z.enum(['element_not_found', 'element_not_clickable', 'window_obscured', 'timeout']),
  uiaSnapshotRef: z.string().optional(),
  at: z.string().datetime(),
});
export type WctlUiaClickMiss = z.infer<typeof WctlUiaClickMissEvent>;

export const WctlOcrCompletedEvent = z.object({
  event: z.literal('wctl.ocr.completed'),
  actionId: z.string().uuid(),
  hostId: z.string(),
  region: z.object({
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).optional(),
  textLength: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
  engine: z.string().optional(),
  at: z.string().datetime(),
});
export type WctlOcrCompleted = z.infer<typeof WctlOcrCompletedEvent>;

export const EVENT_NAMES = {
  actionCompleted: 'wctl.action.completed',
  actionDenied: 'wctl.action.denied',
  uiaClickMiss: 'wctl.uia.click.miss',
  ocrCompleted: 'wctl.ocr.completed',
} as const;
