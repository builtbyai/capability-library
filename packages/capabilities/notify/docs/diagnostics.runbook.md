# notify · diagnostics runbook

## Rung 1 — rules loaded

```bash
curl http://127.0.0.1:5107/api/notify/rules
```

Expect at least one rule with non-empty channels. Empty = no routing, all alerts will drop.

## Rung 2 — channel test

```bash
curl -X POST http://127.0.0.1:5107/api/notify/test -d '{"channel":"slack"}'
```

Expect 200 + `deliveryId`. Failure = adapter misconfigured.

## Rung 3 — recent delivery history

```bash
curl 'http://127.0.0.1:5107/api/notify/history?limit=20'
```

Compare emit rate vs. delivery rate. Big gap = rate-limit hits or adapter failures.

## Symptom → cause

| Symptom | Cause |
|---|---|
| "Why didn't I get alerted?" | `notification.dropped` event for that request. Check `audience` (sharp-edges #2) or rule rate-limit (sharp-edges #1). |
| Slack stopped delivering | Channel deleted or bot kicked. Sharp-edges #3. |
| Oncall paged for non-issue | Severity inflation by source. Sharp-edges #5. |
| WhatsApp 400 outside hours | Session window expired. Use a template. |
