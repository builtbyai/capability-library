/**
 * @multimarcdown/adapter-gmail — Gmail implementation of the email-connector port.
 *
 * Wraps the Gmail REST API (OAuth2) behind the normalized mail surface downstream
 * capabilities consume. Supply a googleapis client + OAuth2 credentials in
 * createGmailAdapter to make it live.
 */
export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface NormalizedMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  receivedAt: string;
  snippet: string;
  attachmentIds: string[];
}

export interface GmailAdapter {
  listMessages(query?: string): Promise<NormalizedMessage[]>;
  getMessage(id: string): Promise<NormalizedMessage>;
  getAttachment(messageId: string, attachmentId: string): Promise<Uint8Array>;
}

export function createGmailAdapter(_config: GmailConfig): GmailAdapter {
  throw new Error('adapter-gmail: not implemented — supply a googleapis client + OAuth2 credentials');
}
