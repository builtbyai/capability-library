# webrtc-stream · _planned_

Peer-to-peer audio/video/data streaming via WebRTC. Signals through a Cloudflare Worker; ICE candidate exchange + DTLS-SRTP for transport. Used for ImpactIQ live walkarounds + remote desktop streaming overflow when Sunshine is unavailable.

**Surfaces:** LiveStreamView, PeerListPanel, SignalingStatus, BandwidthChart, AudioVideoControls
**Emits:** `rtc.session.opened`, `rtc.peer.connected`, `rtc.peer.disconnected`, `rtc.stats.tick`, `rtc.signaling.failed`
**Jobs:** `webrtc-stream:open-session`, `webrtc-stream:close-session`, `webrtc-stream:capture-snapshot`
**Depends on:** connector-config, notify

See `docs/sharp-edges.md` for project-specific landmines.
