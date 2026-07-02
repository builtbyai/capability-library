# notify · sharp edges

## 1. Notification storms during outage retry loops

When `scheduler.job.failed` fires per retry attempt, a single sticky failure produces N notifications (default retry=3 → 3 alerts). Rules MUST rate-limit OR the dispatch path MUST coalesce on `(source, runId)` and only emit the first failure + the final exhausted-retries summary.

## 2. Audience tag mismatch is silent

`audience: 'oncall'` only routes if a rule names that audience. If you typo `audience: 'on-call'`, `notification.dropped{reason:'audience_unknown'}` fires but the user never sees the original message. Audience validation must run at request time — return an error from `dispatch()`, don't only emit a dropped event.

## 3. Slack webhooks expire silently after channel deletion

A 403 from Slack does NOT mean "auth invalid" — it usually means the channel was deleted or the bot was kicked. `notification.delivery.failed` must include the body of Slack's response so the operator can distinguish. Repeated 403s on one rule should mark the connector as degraded + emit `connector.health.changed`.

## 4. WhatsApp business policy windows

Outbound WhatsApp messages outside a 24h window from the recipient's last message require pre-approved templates. The adapter must check and surface a clear error ("outside session window") rather than the generic 400 the WhatsApp API returns.

## 5. Severity inflation by API consumers

Capability authors will mark everything as `error` "just in case". Without enforcement, oncall gets paged for routine issues. The dispatch path should track per-source severity histograms and warn (via the dashboard, not via notify itself) when a source's `error+` rate is > 10% of its emissions.
