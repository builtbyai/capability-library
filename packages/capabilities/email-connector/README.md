# email-connector  ·  _planned_

Gmail + IMAP sync, attachment extraction, and normalized mail events. Providers
are adapters behind one `EmailConnectorPort`.

**Surfaces:** EmailConnectorCard, MailboxPicker, SyncStatusPanel, EmailThreadViewer, AttachmentImportButton
**Emits:** `email.connected`, `email.sync.started`, `email.message.received`, `email.attachment.detected`, `email.classified`
**Depends on:** `connector-config`

**Canonical event:**
```ts
type MailMessageIngested = {
  event: 'email.message.received';
  accountId: string; provider: 'gmail' | 'imap';
  messageId: string; threadId?: string;
  from: string; to: string[]; subject: string;
  receivedAt: string; hasAttachments: boolean; labels?: string[];
};
```

**Boundary rule:** never couple Gmail directly to workflows. Email emits
normalized events; the scheduler and ingestion capabilities subscribe. Attachments
are handed to `intake-pipeline`, not processed here.
