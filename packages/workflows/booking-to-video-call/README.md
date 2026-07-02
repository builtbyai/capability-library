# booking-to-video-call

**Composes:** booking-scheduler, webrtc-stream, notify, scheduler
**Trigger:** booking.created (from booking-scheduler)
**Summary:** Confirmed booking -> create chat-enabled video room -> email join link -> schedule T-24h/T-1h/T-15m reminders -> detect no-show.

Wiring recipe; see `recipe.ts`.
