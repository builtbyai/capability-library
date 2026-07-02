/**
 * gvoice-relay contracts. HMAC-signed SMS port over a headless puppeteer
 * session against voice.google.com. Events cover outbound delivery, inbound
 * polling, delivery failures, and session expiry that requires re-auth.
 */
import { z } from 'zod';

export const E164PhoneSchema = z.string().regex(/^\+[1-9]\d{6,14}$/);

export const SmsMessageSchema = z.object({
  messageId: z.string().uuid(),
  /** Conversation/thread id surfaced by the Google Voice DOM. */
  threadId: z.string(),
  from: E164PhoneSchema,
  to: E164PhoneSchema,
  body: z.string(),
  /** True when the body contained MMS attachments (URLs forwarded as text). */
  hasAttachments: z.boolean().default(false),
  at: z.string().datetime(),
});
export type SmsMessage = z.infer<typeof SmsMessageSchema>;

export const GvoiceSmsSentEvent = z.object({
  event: z.literal('gvoice.sms.sent'),
  message: SmsMessageSchema,
  /** Caller that requested the send (capability id or 'api'). */
  source: z.string(),
});
export type GvoiceSmsSent = z.infer<typeof GvoiceSmsSentEvent>;

export const GvoiceSmsReceivedEvent = z.object({
  event: z.literal('gvoice.sms.received'),
  message: SmsMessageSchema,
});
export type GvoiceSmsReceived = z.infer<typeof GvoiceSmsReceivedEvent>;

export const GvoiceDeliveryFailedEvent = z.object({
  event: z.literal('gvoice.delivery.failed'),
  messageId: z.string().uuid(),
  to: E164PhoneSchema,
  reason: z.enum([
    'recipient-blocked',
    'allowlist-rejected',
    'puppeteer-timeout',
    'session-expired',
    'hmac-invalid',
    'unknown',
  ]),
  error: z.string(),
  willRetry: z.boolean(),
  at: z.string().datetime(),
});
export type GvoiceDeliveryFailed = z.infer<typeof GvoiceDeliveryFailedEvent>;

export const GvoiceSessionExpiredEvent = z.object({
  event: z.literal('gvoice.session.expired'),
  /** Profile path used by the puppeteer session. */
  profile: z.string(),
  /** Whether the relay will attempt a headless re-login or needs operator action. */
  recoverable: z.boolean(),
  at: z.string().datetime(),
});
export type GvoiceSessionExpired = z.infer<typeof GvoiceSessionExpiredEvent>;

export const EVENT_NAMES = {
  smsSent: 'gvoice.sms.sent',
  smsReceived: 'gvoice.sms.received',
  deliveryFailed: 'gvoice.delivery.failed',
  sessionExpired: 'gvoice.session.expired',
} as const;
