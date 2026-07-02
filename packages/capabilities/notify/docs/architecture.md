# notify · architecture

```
caller emits semantic alert
       │
       ▼
NotifyPort.dispatch(NotificationRequest{ source, severity, audience, title, body })
       │
       ▼
rule engine matches against all rules → 0..N matches
       │
       ▼  (one delivery per matched rule × channels)
channel adapters (per packages/adapters/<name>): slack | email | postiz | whatsapp | gvoice-sms | dashboard-toast | os-push | webhook
       │
       ▼
emit notification.sent | notification.delivery.failed
```

Rules are stored in sqlite (`MMD_NOTIFY_DB`). Per-channel rate limits use the `KeyedThrottle` primitive from core (key = `${ruleId}:${channel}`).

## Channel adapters

Each channel is its own thin adapter. Adding a new channel = new adapter implementing `(req: NotificationRequest) => Promise<{deliveryId, ok, error?}>`. The `notify` capability never knows the wire protocol.
