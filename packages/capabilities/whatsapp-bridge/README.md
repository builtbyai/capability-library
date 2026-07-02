# whatsapp-bridge · _planned_

Outbound + inbound WhatsApp via two interchangeable backends (Y:/STRUCTURE_CLI/whatsapp-mcp + Postiz). The user has 5+ skills that talk to WhatsApp; centralizing avoids reinventing the message shape every time.

**Surfaces:** WhatsAppChatList, MessageComposer, MediaUploadPanel, ContactSearch, ClientDigestCard
**Emits:** `whatsapp.message.received`, `whatsapp.message.sent`, `whatsapp.media.received`, `whatsapp.delivery.failed`
**Depends on:** connector-config

## Why centralize

Today there are skills `whatsapp`, `whatsapp-context`, `whatsapp-extract`, `whatsapp-preflight`, `bug-watch`, `client-digest` — each one rebuilds:
- which backend to call (MCP vs Postiz)
- how to format outbound media
- how to normalize 1:1 vs group messages
- session-window awareness for outbound (sharp-edge #4)
- delivery confirmation

This capability collapses all of that into one port.

## Cross-cluster

- Media received → `intake.object.received` (intake-pipeline)
- Messages received → consumable by `bug-watch` workflow, `client-digest` workflow
- Outbound → consumed by `notify` (notify routes alerts here when channel='whatsapp')
