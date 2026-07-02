/** booking-to-video-call -- booking-scheduler -> webrtc-stream -> notify -> scheduler. */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';
import { BookingCreatedEvent } from '../../capabilities/booking-scheduler/contracts/events.js';

/**
 * Subscribes to booking.created. For each new booking:
 *   1. Create a webrtc-stream room with chat (config.persistChat=true for the booking flow)
 *   2. Update the booking with roomSlug + joinUrl + hostUrl (booking-scheduler:patch-room)
 *   3. Emit booking.confirmed via the booking cap (which fires the email path)
 *   4. Register 3 reminder jobs (T-24h, T-1h, T-15m)
 *   5. Register a no-show check 15 min after startAt
 */
export function register(): () => void {
  return bus.on('booking.created', async (e: CoreEvent) => {
    const parsed = BookingCreatedEvent.safeParse(e.payload);
    if (!parsed.success) return;
    const { booking } = parsed.data;

    // Idempotency: if the booking already has a roomSlug (retry), do nothing.
    if (booking.roomSlug) return;

    // 1. Create the room. We persist chat for booked calls (post-call recap value).
    const room = await jobs.run<{ roomId: string; slug: string; joinUrl: string; hostUrl: string }>('webrtc-stream', 'create-room', {
      title: `Booking with ${booking.attendee.name}`,
      hostName: process.env.HOST_NAME ?? 'Host',
      startAt: booking.startAt,
      joinOpenBeforeMin: Number(process.env.JOIN_OPEN_BEFORE_MIN ?? 5),
      requireGuestName: true,
      persistChat: true,
    });

    // 2. Patch the booking record with room metadata.
    await jobs.enqueue('booking-scheduler', 'patch-room', {
      bookingId: booking.bookingId,
      roomSlug: room.slug,
      joinUrl: room.joinUrl,
      hostUrl: room.hostUrl,
    });

    // 3. Register reminders via scheduler.
    const startMs = new Date(booking.startAt).getTime();
    const reminders = [
      { offsetMs: -24 * 60 * 60 * 1000, name: 't-24h' },
      { offsetMs: -1 * 60 * 60 * 1000,  name: 't-1h' },
      { offsetMs: -15 * 60 * 1000,      name: 't-15m' },
    ];
    for (const r of reminders) {
      const fireAt = new Date(startMs + r.offsetMs);
      if (fireAt.getTime() > Date.now()) {
        await jobs.enqueue('scheduler', 'registerOneShot', {
          fireAt: fireAt.toISOString(),
          capabilityId: 'booking-scheduler',
          handler: 'send-reminder',
          input: { bookingId: booking.bookingId, reminderName: r.name },
        });
      }
    }

    // 4. Register no-show detection (startAt + 15 min).
    await jobs.enqueue('scheduler', 'registerOneShot', {
      fireAt: new Date(startMs + 15 * 60 * 1000).toISOString(),
      capabilityId: 'booking-scheduler',
      handler: 'detect-no-show',
      input: { bookingId: booking.bookingId, roomId: room.roomId },
    });
  });
}
