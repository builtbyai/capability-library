/**
 * whatsapp-bridge contracts. Normalized message shape regardless of whether
 * the backend was MCP-bridge (Y:/STRUCTURE_CLI/whatsapp-mcp) or Postiz.
 */
import { z } from 'zod';

export const WhatsAppBackendSchema = z.enum(['mcp-bridge', 'postiz']);
export type WhatsAppBackend = z.infer<typeof WhatsAppBackendSchema>;

export const WhatsAppMessageSchema = z.object({
  messageId: z.string(),
  chatId: z.string(),
  backend: WhatsAppBackendSchema,
  direction: z.enum(['inbound', 'outbound']),
  /** Normalized E.164 sender; group chats use the group id, sender is in `from`. */
  from: z.string(),
  /** For group messages, the chat id; for 1:1, equal to `from`. */
  chat: z.string(),
  text: z.string().optional(),
  /** ContentRef-shaped attachments; bytes stored via intake-pipeline. */
  media: z.array(z.object({
    mimeType: z.string(),
    contentHash: z.string(),
    bytes: z.number().int().nonnegative(),
    caption: z.string().optional(),
  })).default([]),
  receivedAt: z.string().datetime(),
});
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;

export const WhatsAppChatSchema = z.object({
  chatId: z.string(),
  /** E.164 for 1:1, group id for groups. */
  isGroup: z.boolean(),
  displayName: z.string(),
  lastMessageAt: z.string().datetime().optional(),
  unreadCount: z.number().int().nonnegative().default(0),
});
export type WhatsAppChat = z.infer<typeof WhatsAppChatSchema>;

export const MessageReceivedEvent  = z.object({ event: z.literal('whatsapp.message.received'), message: WhatsAppMessageSchema });
export const MessageSentEvent      = z.object({ event: z.literal('whatsapp.message.sent'), messageId: z.string(), chatId: z.string(), backend: WhatsAppBackendSchema, at: z.string() });
export const MediaReceivedEvent    = z.object({ event: z.literal('whatsapp.media.received'), messageId: z.string(), chatId: z.string(), mediaIndex: z.number().int(), intakeObjectId: z.string().uuid() });
export const DeliveryFailedEvent   = z.object({ event: z.literal('whatsapp.delivery.failed'), chatId: z.string(), backend: WhatsAppBackendSchema, reason: z.enum(['outside_session_window', 'opt_out', 'invalid_number', 'rate_limited', 'unknown']), detail: z.string().optional() });

export const EVENT_NAMES = {
  received: 'whatsapp.message.received',
  sent: 'whatsapp.message.sent',
  mediaReceived: 'whatsapp.media.received',
  deliveryFailed: 'whatsapp.delivery.failed',
} as const;

export interface WhatsAppBridgePort {
  send(input: { chatId: string; text?: string; mediaUri?: string; backend?: WhatsAppBackend }): Promise<{ messageId: string }>;
  listChats(): Promise<WhatsAppChat[]>;
  listMessages(chatId: string, opts?: { limit?: number; before?: string }): Promise<WhatsAppMessage[]>;
  searchContacts(query: string): Promise<Array<{ name: string; phone: string }>>;
}
