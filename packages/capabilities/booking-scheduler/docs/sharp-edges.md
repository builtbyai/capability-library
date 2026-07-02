# booking-scheduler · sharp edges

## 1. Slot picker timezone gotcha

The client picks a slot in their local TZ; the server stores ISO UTC. When the host views the booking in `HOST_TIMEZONE`, the displayed time may differ by hours. The confirmation email MUST show times in BOTH the attendee's and host's timezones to avoid "I thought we said 3pm" misalignment.

## 2. Slot collision between availability query and book

A user fetches availability at T=0, picks a slot, fills the form, hits book at T=60s. In that window another user could have booked the same slot. The `/api/book` endpoint MUST re-validate the slot is still open under a transaction; reject with a clear "slot no longer available" if not, and ask the user to pick another.

## 3. Google free/busy refresh OAuth weekly

Per user memory `impactiq_oauth_rotation.md` + Google's Testing-mode token cap: refresh tokens expire after 7 days in Testing. Production requires app verification. Until verified, the capability must surface `GOOGLE_FREEBUSY_DISABLED` cleanly when refresh fails — DO NOT fall back to synthetic slots silently (the host's actual calendar conflicts get hidden).

## 4. nodemailer Gmail App Password vs OAuth2

App Password works (16-char string) but is brittle — Workspace admin can revoke at will, and Google has been deprecating it for years. Document the migration path to OAuth2 SMTP (XOAUTH2) so this doesn't become a 2am page when an admin rotates passwords.

## 5. MailChannels was free; now it's not

As of mid-2024, MailChannels announced paid tier for new Cloudflare Worker accounts. The Worker code in wts-scheduler/worker/ assumes free MailChannels. Surface this in setup; document Resend / Brevo as drop-in alternatives.

## 6. ICS file attachment encoding

If the ICS body contains a comma in DESCRIPTION (which it usually does — the attendee's notes), it MUST be escaped per RFC 5545 (backslash-comma). Some clients (Outlook desktop) reject the entire event silently if escaping is wrong.

## 7. Reschedule = new room or same room?

Default behavior in wts-scheduler is: cancel old room, create new room. But guests already have the old `/j/<slug>` link. The capability MUST email the new link AND keep the old slug redirecting to the new room for 24h (or surface "rescheduled" page) — otherwise the original calendar invite link is dead.

## 8. No-show detection has a false-positive class

If the host opens the room but the attendee is 12 minutes late, `webrtc-stream.listParticipants` returns [host-only] at T+10. A naive "no-show" emit would wrongly accuse the attendee. Wait 15 minutes AND check that the host actually joined (host stats indicate they were online >2 min) before emitting `booking.no-show`.

## 9. Phone field is optional but should validate format

If supplied, validate as E.164 (+15551234567). Booking-scheduler accepts free-form, but downstream `whatsapp-bridge` or `gvoice-relay` reminders require E.164. Normalize at the contract boundary; reject obviously-invalid (`<3 digits`) at write time.

## 10. Per-service intakeFields drift

If you add a `intakeFields[]` entry to a service AFTER bookings exist for that service, old bookings will lack the field. Render with `intake[field.key] ?? '(not asked)'` in the host email, never throw on missing.
