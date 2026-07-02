/**
 * notify contracts. One port, many channels. Subscribers (scheduler, cost-ledger,
 * connector-config) emit semantic alerts; notify resolves audience + channels
 * via rules and dispatches.
 */
import { z } from 'zod';

export const NotificationSeverity = z.enum(['debug', 'info', 'warn', 'error', 'critical']);
export type NotificationSeverity = z.infer<typeof NotificationSeverity>;

export const NotificationChannel = z.enum([
  'slack', 'email', 'postiz', 'whatsapp', 'gvoice-sms', 'dashboard-toast', 'os-push', 'webhook',
]);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const NotificationRequestSchema = z.object({
  /** Capability id of the emitter. */
  source: z.string(),
  severity: NotificationSeverity,
  /** Free-form audience tag; rules route on this (e.g. 'oncall', 'admin', 'me'). */
  audience: z.string(),
  title: z.string().max(200),
  body: z.string(),
  /** Optional deep-link or related-entity reference. */
  link: z.string().url().optional(),
  /** Capability-specific metadata that channel adapters may format on. */
  meta: z.record(z.unknown()).default({}),
});
export type NotificationRequest = z.infer<typeof NotificationRequestSchema>;

export const NotificationRuleSchema = z.object({
  ruleId: z.string().uuid(),
  /** Match expression — minimal DSL: 'severity:>=error AND source:scheduler'. */
  match: z.string(),
  channels: z.array(NotificationChannel).min(1),
  audience: z.string(),
  /** Optional rate-limit: at most N matches per windowMs. */
  rateLimit: z.object({ n: z.number().int().positive(), windowMs: z.number().int().positive() }).optional(),
});
export type NotificationRule = z.infer<typeof NotificationRuleSchema>;

export const NotificationSentEvent           = z.object({ event: z.literal('notification.sent'), deliveryId: z.string(), channel: NotificationChannel, audience: z.string(), severity: NotificationSeverity, at: z.string() });
export const NotificationDeliveryFailedEvent = z.object({ event: z.literal('notification.delivery.failed'), deliveryId: z.string(), channel: NotificationChannel, error: z.string(), willRetry: z.boolean() });
export const NotificationDroppedEvent        = z.object({ event: z.literal('notification.dropped'), reason: z.enum(['rate_limited', 'no_rule_match', 'audience_unknown']), request: NotificationRequestSchema });

export const EVENT_NAMES = {
  sent: 'notification.sent',
  deliveryFailed: 'notification.delivery.failed',
  dropped: 'notification.dropped',
} as const;

export interface NotifyPort {
  dispatch(req: NotificationRequest): Promise<{ deliveryIds: string[] }>;
  addRule(rule: Omit<NotificationRule, 'ruleId'>): Promise<NotificationRule>;
  test(input: { channel: NotificationChannel }): Promise<{ deliveryId: string; ok: boolean }>;
}
