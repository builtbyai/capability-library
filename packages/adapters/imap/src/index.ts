/**
 * @multimarcdown/adapter-imap — generic IMAP implementation of the email-connector port.
 *
 * Provider-agnostic mailbox sync for hosts without a Gmail-style API. Emits the
 * same NormalizedMessage shape as adapter-gmail so downstream automation is
 * identical. Wire a real IMAP client (e.g. imapflow) in createImapAdapter.
 */
export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  mailbox?: string;
}

export interface ImapMessage {
  uid: number;
  from: string;
  to: string[];
  subject: string;
  date: string;
  hasAttachments: boolean;
}

export interface ImapAdapter {
  fetchSince(since: Date): Promise<ImapMessage[]>;
  fetchBody(uid: number): Promise<string>;
  close(): Promise<void>;
}

export function createImapAdapter(_config: ImapConfig): ImapAdapter {
  throw new Error('adapter-imap: not implemented — supply an IMAP client (e.g. imapflow)');
}
