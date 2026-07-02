# email-connector · sharp edges

## 1. Gmail OAuth "Testing" mode caps refresh tokens at 7 days
Until the OAuth app is moved to production+verified, every connector needs re-auth weekly. Surface `tokenExpiresAt` in `SyncStatusPanel` and emit `email.disconnected` proactively instead of failing mid-sync.

## 2. IMAP UID rollover (UIDVALIDITY change)
Rare but real (server restore-from-backup). Naive resume re-emits the entire mailbox. Cursor must be `{uidValidity, lastUid}` and reset gracefully on validity change.

## 3. Gmail-via-IMAP vs Gmail-via-API differ on labels
IMAP exposes labels as folders; the API exposes them as a flat list. Normalize to flat `labels: string[]`; never emit the literal `[Gmail]/All Mail` folder name.

## 4. Attachment dedup must use contentHash, not filename
Five `invoice.pdf` emails are usually five different invoices; ten `image001.png` are usually one tracking pixel. Both wrong-answer without contentHash.

## 5. First-sync of a 50MB mailbox swamps the bus
Batch-emit one `email.sync.completed{newMessages:N}` per N messages; let `intake-pipeline` pull by cursor instead of streaming each through `bus.emit`.
