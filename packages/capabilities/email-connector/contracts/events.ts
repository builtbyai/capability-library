/**
 * email-connector contracts. Provider specifics (Gmail OAuth, IMAP) live in
 * packages/adapters/{gmail,imap}; this capability owns the normalized shape.
 */
import { z } from 'zod';

export const MailProviderSchema = z.enum(['gmail', 'imap']);
export type MailProvider = z.infer<typeof MailProviderSchema>;

export const MailAddressSchema = z.string().email();

export const MailMessageReceivedSchema = z.object({
  accountId: z.string(),
  provider: MailProviderSchema,
  messageId: z.string(),
  uid: z.number().optional(),
  threadId: z.string().optional(),
  from: MailAddressSchema,
  to: z.array(MailAddressSchema),
  cc: z.array(MailAddressSchema).default([]),
  subject: z.string(),
  receivedAt: z.string(),
  hasAttachments: z.boolean(),
  labels: z.array(z.string()).default([]),
  snippet: z.string().optional(),
});
export type MailMessageReceived = z.infer<typeof MailMessageReceivedSchema>;

export const EmailAttachmentDetectedSchema = z.object({
  accountId: z.string(),
  messageId: z.string(),
  attachmentId: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type EmailAttachmentDetected = z.infer<typeof EmailAttachmentDetectedSchema>;

export const EmailConnectedSchema    = z.object({ accountId: z.string(), provider: MailProviderSchema, connectorId: z.string() });
export const EmailDisconnectedSchema = z.object({ accountId: z.string(), reason: z.enum(['manual', 'auth-revoked', 'imap-timeout-loop']) });
export const EmailSyncStartedSchema  = z.object({ accountId: z.string(), runId: z.string(), cursor: z.string().optional() });
export const EmailSyncCompletedSchema= z.object({ accountId: z.string(), runId: z.string(), newMessages: z.number(), newAttachments: z.number(), nextCursor: z.string() });
export const EmailSyncFailedSchema   = z.object({ accountId: z.string(), runId: z.string(), error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }) });
export const EmailClassifiedSchema   = z.object({ accountId: z.string(), messageId: z.string(), labels: z.array(z.string()) });
export const EmailOauthTokenRefreshedSchema = z.object({ accountId: z.string(), connectorId: z.string(), at: z.string(), expiresAt: z.string() });

export const EVENT_NAMES = {
  connected:    'email.connected',
  disconnected: 'email.disconnected',
  syncStarted:  'email.sync.started',
  syncCompleted:'email.sync.completed',
  syncFailed:   'email.sync.failed',
  messageReceived:    'email.message.received',
  attachmentDetected: 'email.attachment.detected',
  classified:   'email.classified',
  oauthRefreshed: 'email.oauth.token.refreshed',
} as const;

export interface EmailConnectorPort {
  connect(input: { provider: MailProvider; connectorId: string }): Promise<{ accountId: string }>;
  sync(accountId: string): Promise<{ runId: string }>;
  disconnect(accountId: string): Promise<void>;
  listMessages(query: { accountId: string; since?: string }): Promise<MailMessageReceived[]>;
}
