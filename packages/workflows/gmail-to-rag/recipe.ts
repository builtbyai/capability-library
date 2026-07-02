/** gmail-to-rag -- email-connector -> intake-pipeline -> document-ingestion -> knowledge-index. */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';
import { EmailAttachmentDetectedSchema } from '../../capabilities/email-connector/contracts/events.js';

export function register(): () => void {
  return bus.on('email.attachment.detected', async (e: CoreEvent) => {
    const parsed = EmailAttachmentDetectedSchema.safeParse(e.payload);
    if (!parsed.success) return;
    // Attachment bytes are already in the email-connector local store.
    // Hand off to intake; intake routes by MIME to document-ingestion or media-processing.
    await jobs.enqueue('intake-pipeline', 'ingestEmailAttachment', {
      accountId: parsed.data.accountId,
      messageId: parsed.data.messageId,
      attachmentId: parsed.data.attachmentId,
    });
  });
}
