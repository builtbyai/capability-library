# gvoice-relay · _planned_

HMAC-signed SMS relay on BBWADMIN: headless puppeteer drives voice.google.com. Runs as scheduled tasks at Admin logon. Inbound poll + outbound HTTP API.

**Surfaces:** GvoiceStatusCard, SmsHistoryTable, TestRecipientPicker, HmacKeyRotator
**Emits:** `gvoice.sms.sent`, `gvoice.sms.received`, `gvoice.delivery.failed`, `gvoice.session.expired`
**Depends on:** connector-config, notify, scheduler

See `docs/sharp-edges.md` for project-specific landmines (encoded from user memories).
