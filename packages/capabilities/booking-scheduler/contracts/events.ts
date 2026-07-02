/**
 * booking-scheduler contracts. Sourced from C:/Code/wts-scheduler.
 *
 * Flow: client picks service → fetches availability → submits booking →
 * server creates a webrtc-stream room → emails confirmation with /j/<slug>
 * link → guests join.
 */
import { z } from 'zod';

// ============================================================================
// Services (the catalog of bookable session types)
// ============================================================================

export const ServiceSchema = z.object({
  serviceId: z.string(),                                 // e.g. 'discovery-15'
  title: z.string(),                                     // 'Discovery Call'
  description: z.string().optional(),
  durationMin: z.number().int().positive(),              // 15, 30, 60
  priceUSD: z.number().nonnegative().optional(),         // 0 = free
  /** Optional service-specific intake questions. */
  intakeFields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    required: z.boolean().default(false),
    kind: z.enum(['text', 'textarea', 'email', 'phone', 'select']),
    options: z.array(z.string()).optional(),
  })).default([]),
});
export type Service = z.infer<typeof ServiceSchema>;

// ============================================================================
// Availability
// ============================================================================

export const AvailabilityQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  durationMin: z.number().int().positive(),
  serviceId: z.string().optional(),
});

export const AvailabilityResponseSchema = z.object({
  /** Map of ISO local-day (e.g. '2026-06-10') → array of ISO slot starts. */
  slotsByDay: z.record(z.string(), z.array(z.string().datetime())),
  timeZone: z.string().nullable(),
});
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;

// ============================================================================
// Attendee
// ============================================================================

export const AttendeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  /** Free-form key/value pairs from intakeFields. */
  intake: z.record(z.string(), z.unknown()).default({}),
});
export type Attendee = z.infer<typeof AttendeeSchema>;

// ============================================================================
// Booking
// ============================================================================

export const BookingStatusSchema = z.enum([
  'pending',           // created but not confirmed (rare)
  'confirmed',         // email + room created
  'cancelled',
  'rescheduled',
  'no-show',
  'completed',
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingRequestSchema = z.object({
  serviceId: z.string(),
  durationMin: z.number().int().positive(),
  startAt: z.string().datetime(),
  attendee: AttendeeSchema,
  timezone: z.string(),
  /** Optional: skip email confirmation (for tests or programmatic flows). */
  skipEmail: z.boolean().default(false),
});
export type BookingRequest = z.infer<typeof BookingRequestSchema>;

export const BookingSchema = z.object({
  bookingId: z.string().uuid(),
  serviceId: z.string(),
  durationMin: z.number().int().positive(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  attendee: AttendeeSchema,
  timezone: z.string(),
  status: BookingStatusSchema,
  /** webrtc-stream room slug (the /j/<slug> short-URL fragment). */
  roomSlug: z.string().regex(/^[A-Za-z0-9]{6,16}$/).optional(),
  /** Full public join URL (PUBLIC_BASE + /j/ + roomSlug). */
  joinUrl: z.string().url().optional(),
  /** Host-only URL that bypasses the joinOpenBeforeMin window. */
  hostUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
});
export type Booking = z.infer<typeof BookingSchema>;

// ============================================================================
// Events
// ============================================================================

export const AvailabilityQueriedEvent = z.object({ event: z.literal('booking.availability.queried'), query: AvailabilityQuerySchema, at: z.string() });
export const BookingCreatedEvent      = z.object({ event: z.literal('booking.created'),       booking: BookingSchema });
export const BookingConfirmedEvent    = z.object({ event: z.literal('booking.confirmed'),     bookingId: z.string().uuid(), joinUrl: z.string().url(), at: z.string() });
export const BookingCancelledEvent    = z.object({ event: z.literal('booking.cancelled'),     bookingId: z.string().uuid(), reason: z.string().optional(), at: z.string() });
export const BookingRescheduledEvent  = z.object({ event: z.literal('booking.rescheduled'),   bookingId: z.string().uuid(), newStartAt: z.string().datetime(), at: z.string() });
export const BookingReminderSentEvent = z.object({ event: z.literal('booking.reminder.sent'), bookingId: z.string().uuid(), channel: z.enum(['email', 'sms', 'whatsapp']), at: z.string() });
export const BookingNoShowEvent       = z.object({ event: z.literal('booking.no-show'),       bookingId: z.string().uuid(), at: z.string() });

export const EVENT_NAMES = {
  availabilityQueried: 'booking.availability.queried',
  created:             'booking.created',
  confirmed:           'booking.confirmed',
  cancelled:           'booking.cancelled',
  rescheduled:         'booking.rescheduled',
  reminderSent:        'booking.reminder.sent',
  noShow:              'booking.no-show',
} as const;

// ============================================================================
// Port
// ============================================================================

export interface BookingSchedulerPort {
  listServices(): Promise<Service[]>;
  queryAvailability(input: z.infer<typeof AvailabilityQuerySchema>): Promise<AvailabilityResponse>;
  createBooking(input: BookingRequest): Promise<Booking>;
  getBooking(bookingId: string): Promise<Booking | null>;
  cancelBooking(bookingId: string, reason?: string): Promise<Booking>;
  rescheduleBooking(bookingId: string, newStartAt: string): Promise<Booking>;
}

// ============================================================================
// Constants from wts-scheduler defaults
// ============================================================================

export const DEFAULT_SERVICES: Service[] = [
  { serviceId: 'discovery-15', title: 'Discovery Call',   durationMin: 15, intakeFields: [] },
  { serviceId: 'strategy-30',  title: 'Strategy Session', durationMin: 30, intakeFields: [] },
  { serviceId: 'workshop-60',  title: 'Working Session',  durationMin: 60, intakeFields: [] },
];

/** wts-scheduler synthetic availability defaults (replaced by Google free/busy when env set). */
export const DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DEFAULT_WORK_START_HOUR = 8;
export const DEFAULT_WORK_END_HOUR = 19;
