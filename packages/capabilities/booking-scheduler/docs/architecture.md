# booking-scheduler · architecture

## Two deployment modes (same contracts)

### Mode A — local Express + nodemailer (dev / on-prem)

```
client (Vite + React on :5173)
    ↓
Express server (:5174)
    ↓
file-backed JSON bookings store
    ↓
nodemailer (Gmail SMTP App Password)
    ↓
fetch $SIGNALING_BASE/rooms → roomSlug → /j/<slug> URL
```

### Mode B — Cloudflare Workers + D1 + MailChannels (production)

```
client (SPA served via Workers static assets binding)
    ↓
Worker (worker/index.js)
    ↓
D1 (wts-scheduler-bookings)
    ↓
MailChannels (Workers-native; no nodemailer)
    ↓
fetch $SIGNALING_BASE/rooms (same dashboard-signaling Worker)
```

`BookingSchedulerPort` is the same interface in both modes; the capability ships both impls under `backend/express.ts` and `backend/worker.ts`. Switching is a config thing, not a code thing.

## Availability

Default: synthetic slots across WORK_DAYS (0-6 = all week) within WORK_START..WORK_END (8-19), in `durationMin` increments, minus already-booked rows.

With Google free/busy: query the host's calendar via `GOOGLE_FREEBUSY_CALENDAR_ID`; subtract busy windows from the synthetic generator. Same `{ slotsByDay, timeZone }` response shape.

## Booking ID + room slug separation

The `bookingId` is a UUIDv4 (32 hex chars, internal). The `roomSlug` is the 8-char base62 slug shared with `webrtc-stream` (the one humans paste into chat). Two fields on the same Booking record. The `/j/<slug>` URL hits webrtc-stream's redirect endpoint; the `/api/join/:bookingId` endpoint is a server-side resolve-and-redirect for the host-side flow.

## Email

Templates live in `templates/`. The capability ships:
- `attendee-confirmation.html.hbs` — to attendee; ICS attachment; join link
- `host-confirmation.html.hbs` — to host; attendee details; intake answers
- `reminder.html.hbs` — T-24h, T-1h, T-15m
- `cancellation.html.hbs` — both sides
- `reschedule.html.hbs` — both sides; new join link (same room or fresh, configurable)

Workers mode uses MailChannels; Express mode uses nodemailer. The template files are environment-agnostic.

## ICS file generation

Standard RFC 5545 VEVENT. UID = `bookingId@PUBLIC_BASE`. LOCATION = the join URL. ORGANIZER = HOST_EMAIL. ATTENDEE = attendee.email. Generated server-side, attached to confirmation email.

## Cross-capability events

| When | Emit |
|---|---|
| Slot list returned | `booking.availability.queried` |
| Booking row INSERTed | `booking.created` |
| Email + room URL ready | `booking.confirmed` |
| `scheduler` cron T-24h | `booking.reminder.sent {channel:'email'}` |
| `webrtc-stream.listParticipants` returns empty 10 min after startAt | `booking.no-show` |
| Cancel endpoint hit | `booking.cancelled` |
