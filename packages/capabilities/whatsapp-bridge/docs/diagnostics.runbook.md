# whatsapp-bridge · diagnostics runbook

## Rung 1 — backend reachable

```bash
curl -fsSL "$WHATSAPP_MCP_URL/health"   # MCP bridge
curl -fsSL https://postiz.wardtechsystems.com/api/public/v1/integrations -H "Authorization: Bearer $POSTIZ_API_KEY"
```

Both 200. Failure on one is graceful — capability falls back to the other backend; failure on both is a hard outage.

## Rung 2 — send smoke

```bash
curl -X POST http://127.0.0.1:5110/api/whatsapp/messages \
  -d '{"chatId":"+15555550100","text":"smoke test from $(hostname)"}'
```

(Uses test allowlist; sharp-edges #1.)

## Rung 3 — inbound receive

Send a message to the bridge from one of the test recipients. Within 5s, `whatsapp.message.received` should fire on the bus. Confirm via `GET /api/whatsapp/chats/.../messages`.

## Symptom → cause

| Symptom | Cause |
|---|---|
| `outside_session_window` errors | 24h rule (sharp-edges #2). Use a template or wait for inbound. |
| Group messages duplicated | Backend id normalization missing (sharp-edges #3). |
| Media 404 on download | URL expired before fetch (sharp-edges #4). Fetch eagerly in handler. |
| Send to non-allowlisted number rejected | Intentional. Either expand `WHATSAPP_TEST_ALLOWLIST` or fix the caller. |
