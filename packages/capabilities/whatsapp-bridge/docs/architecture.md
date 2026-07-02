# whatsapp-bridge · architecture

Two interchangeable backends behind one port:

```
send/receive → WhatsAppBridgePort
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
   mcp-bridge            postiz-api
   (Y:/STRUCTURE_CLI/    (postiz.wardtechsystems.com)
    whatsapp-mcp)
       │                     │
       └──────────┬──────────┘
                  ▼
       Normalized WhatsAppMessage
                  │
                  ▼
       bus.emit('whatsapp.message.received')
                  │
                  ▼ (if message has media)
       intake-pipeline.ingestUpload
       bus.emit('whatsapp.media.received', { intakeObjectId })
```

Backend selection: per-chat preference (some chats route through MCP for low-latency receive, others through Postiz for scheduling). Default backend via `WHATSAPP_DEFAULT_BACKEND` env.

## Inbound polling vs webhook

MCP bridge keeps a persistent connection; messages stream as they arrive. Postiz uses a webhook; the capability hosts the webhook receiver at `POST /api/whatsapp/webhook/postiz`. Both paths converge on `WhatsAppMessage` and emit the same event.
