# email-connector · architecture

Two adapters behind one port: `packages/adapters/gmail` (OAuth + Gmail API) and `packages/adapters/imap` (imapflow). Both implement `EmailConnectorPort`.

Sync is cron-driven via `scheduler` (`email-connector:syncAccount` job per account). Cursor format `{uidValidity, lastUid}`. Attachments are detected and emitted as `email.attachment.detected` with `contentHash` — `intake-pipeline` subscribes and stages each attachment.

OAuth refresh runs hourly (`email-connector:refreshOauth`); refresh failures emit `email.disconnected{reason:'auth-revoked'}` proactively.
