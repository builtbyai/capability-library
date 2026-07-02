# booking-scheduler · _prototype_

5-step modal booking flow (Service → Date → Time → Details → Confirm) with availability calculation, D1 persistence, SMTP/MailChannels confirmation email, and short-slug join-link generation delegated to `webrtc-stream`.

**Sourced from:** `C:/Code/wts-scheduler` — Vite + React + Express + Cloudflare Worker production app.

**Surfaces:** SchedulerModal, SchedulerPage, Step1Service, Step2Date, Step3Time, Step4Details, Step5Confirm, ConfirmedBanner
**Emits:** `booking.availability.queried`, `booking.created`, `booking.confirmed`, `booking.cancelled`, `booking.rescheduled`, `booking.reminder.sent`, `booking.no-show`
**Depends on:** webrtc-stream, notify, connector-config

## Flow

```
client opens scheduler modal
    ↓ Step 1: pick service (Discovery 15 / Strategy 30 / Workshop 60 — pluggable)
    ↓ Step 2: pick date (calendar grid; days with no slots disabled)
    ↓ Step 3: pick time (slot picker honors timezone; respects Google free/busy if env set)
    ↓ Step 4: details (name, email, phone, notes + per-service intakeFields)
    ↓ Step 5: confirm + show /j/<slug> join link
            ↓
    server-side:
      - validate input + slot still open
      - INSERT booking row in D1
      - POST $SIGNALING_BASE/rooms to create webrtc-stream room
      - send confirmation email (host + attendee, with ICS + join URL)
      - emit booking.created + booking.confirmed
```

## Why a library capability vs. just a Vite app

The wts-scheduler app is monolithic. The capability extracts:
- **Contracts**: zod-validated `Service`, `Booking`, `AvailabilityResponse`, `Attendee`
- **Hooks**: `useAvailability`, `useBookingForm` (greenfield; lift from the React state in wts-scheduler/src)
- **Reusable steps**: each Step1-5 component is independently composable for non-modal contexts (full-page scheduler, embeddable iframe, etc.)
- **Backend port**: `BookingSchedulerPort` interface so the same UI works against Express + node + sqlite OR Cloudflare Worker + D1 + MailChannels with no UI changes

## Brand pluggability

Per user memory `impactiq_brand_palette.md` + wts-scheduler's existing tokens.css, themes ship as CSS-variable presets:
- `ward-tech-systems` (default, gold)
- `impactiq` (Storm-Gold, ImpactIQ specific)
- `generic` (blue/neutral)

## Cross-capability handoff

- `booking.confirmed` event triggers `notify` for the email path (instead of inline nodemailer, eventually)
- The room creation is delegated to `webrtc-stream.createRoom()` — booking-scheduler doesn't reinvent WebRTC
- Reminders run via `scheduler` capability (T-24h, T-1h, T-15m emails/SMS via `notify`)
- No-show detection via `scheduler` + `webrtc-stream.listParticipants(roomId)` 10 min after startAt
