# webrtc-stream · sharp edges

## 1. Direct-link 10.0.0.x bypasses ICE NAT traversal entirely

node-a<->node-b direct ethernet is sub-ms; advertise their LAN addresses in the candidate list. If you only ship Tailscale candidates, RTT triples for no reason. See user memory `bbw_pcc_direct_link.md`.

## 2. TURN credentials must rotate

Static TURN passwords leak via JS console snapshots. Use TURN-REST short-term tokens (1h TTL) generated server-side per session via `issueTurnCredential(roomId, peerId)`. Never embed long-lived TURN passwords in the JS bundle.

## 3. iOS Safari audio capture needs a user gesture per session

Safari forbids `getUserMedia({audio:true})` if not triggered by a click in the same task. Resuming a session after backgrounding the tab will require a new click. The `RoomJoinScreen` must always render a "Join" button — never auto-join — for iOS compatibility.

## 4. Codec negotiation is rough across vendors

Chrome defaults to VP9; Safari to H.264 (hardware-accelerated). If you force VP9 in the SDP, Safari falls back to software decode = battery drain. Let the browser negotiate.

## 5. DataChannel ordering vs reliability is a config trap

For live cursor sharing you want unordered + unreliable. For chat you want ordered + reliable. Open TWO DataChannels per peer: `chat` (ordered + reliable) and `presence` (unordered + unreliable, ~50ms heartbeats). Don't multiplex them on one channel.

## 6. Short-slug collision is finite, not impossible

The 8-char base62 alphabet (54 chars after dropping 0/O/1/I/l) gives ~7.2e13 combos. At 1k rooms/day it would take ~200,000 years to expect one collision — but persistence layer MUST enforce `UNIQUE(slug)` and retry generation on conflict, NOT trust the entropy.

## 7. Join window vs clock skew

`joinOpenBeforeMin` defaults to 5 minutes. A guest with a clock skewed +6 min will see "room not yet open" right when the host is expecting them. The Worker MUST compute the window against its own clock (Cloudflare time), never trust the client; surface the open time to the guest with a server-side countdown.

## 8. Chat persistence + GDPR/CCPA

`persistChat: true` means messages live in D1 until manually purged. Add a `purgeChat(roomId)` admin method + a configurable retention default (90 days). Chat messages have user identifiers attached; treat as PII.

## 9. Host disconnect != room end

If the host's connection drops but the host hasn't called `endRoom()`, guests can continue talking. That's intentional (network blips shouldn't kill calls), but the UI must surface "host has left" + give a guest a way to formally end the room after a grace period (default 5 min) without host action.

## 10. /j/<slug> link in chat apps triggers og-unfurl-proxy

When you share a /j/<slug> link in WhatsApp/Slack/Discord, the crawler hits the URL to fetch Open Graph tags. Per user memory `og-unfurl-proxy`: that fetch may need the UA-spoof Worker in front. If the join URL is on a host with bot-challenge protection, deploy `og-unfurl-proxy` for the /j/* route too.

## 11. Booking flow handoff window

The `booking-to-video-call` workflow creates a room when the booking confirms. If the user re-confirms a booking (idempotent retry), DO NOT create a second room — look up the existing roomId via booking metadata and return the same join URL. wts-scheduler's booking record carries `roomSlug` exactly for this.
