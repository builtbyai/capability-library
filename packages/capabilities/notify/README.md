# notify · _planned_

One notification port; many channels. Subscribers of `scheduler.job.failed`, `connector.health.changed`, `cost.recorded` (over threshold), and `document.ingestion.failed` route through here instead of each calling Slack/email/Postiz directly.

**Surfaces:** NotificationCenter, ChannelRoutingEditor, AlertRuleEditor, ToastHost
**Emits:** `notification.sent`, `notification.delivery.failed`, `notification.dropped`
**Depends on:** connector-config (per-channel credentials)

## Why centralize

Without it, every alert source reinvents:
- channel routing (which alerts go to Slack vs. email vs. SMS?)
- rate limiting (cost spike notifications can flood)
- delivery retry + failure tracking
- "did the alert actually arrive?" auditing

`notify` consolidates all of it into rules + a single bus event `notification.sent`.

## Routing model

Rules match against `(severity, source, audience)` and resolve to one or more channels. Rate limits are per-rule. A request with no matching rule fires `notification.dropped{reason:'no_rule_match'}` — never silently disappears.
