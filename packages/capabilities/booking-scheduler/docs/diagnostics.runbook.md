# booking-scheduler · diagnostics runbook

## Rung 1 — smtp + signaling reachable

```bash
# SMTP
node -e "import('nodemailer').then(nm => nm.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT),secure:true,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}).verify().then(console.log).catch(console.error))"

# Signaling
curl -s "$SIGNALING_BASE/health"
```

Both must return ok / 200. If SMTP fails: check App Password didn't rotate. If signaling fails: dashboard-signaling Worker is down (rare; affects all booking video calls).

## Rung 2 — availability roundtrip

```bash
curl 'http://127.0.0.1:5174/api/availability?from=2026-06-10T00:00:00Z&to=2026-06-12T00:00:00Z&durationMin=30'
```

Expect a non-empty `slotsByDay`. Empty everywhere = synthetic slot generator is misconfigured (check WORK_DAYS / WORK_START / WORK_END) OR Google free/busy is returning the whole window as busy.

## Rung 3 — end-to-end booking smoke

```bash
curl -X POST http://127.0.0.1:5174/api/book -H 'Content-Type: application/json' -d '{
  "serviceId":"strategy-30",
  "durationMin":30,
  "startAt":"2026-06-12T14:00:00Z",
  "attendee":{"name":"Test","email":"test@example.invalid","phone":"+15551234567"},
  "timezone":"America/Chicago"
}'
```

Expect a Booking with `roomSlug` and `joinUrl`. Open `joinUrl` in a browser — should land on the webrtc-stream RoomJoinScreen.

## Symptom → cause

| Symptom | Cause |
|---|---|
| `joinUrl` missing in response | `webrtc-stream.createRoom()` failed. Check signaling Worker logs. |
| Email arrives but no ICS | ICS attachment encoding bug (sharp-edges #6). Check the booking's DESCRIPTION for unescaped commas. |
| Host sees booking at wrong time | TZ confusion. Email shows both TZs; confirm by inspecting raw `startAt` ISO. |
| Slot booked twice for same time | Slot validation race (sharp-edges #2). Add a unique constraint on `(serviceId, startAt)` in D1. |
| `booking.no-show` fires when attendee was just late | Sharp-edges #8. Increase grace period. |
| Reschedule kills calendar invite | Old slug redirect missing (sharp-edges #7). Surface 24h grace + new link. |
