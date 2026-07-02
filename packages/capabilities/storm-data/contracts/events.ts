/**
 * storm-data contracts. Multi-provider weather + storm event aggregation (NOAA,
 * HailTrace, RoofLink, OpenWeatherMap, NWS) keyed by location/date. Normalized
 * records feed ImpactIQ claim generation; per-provider rate-limit + cache layer.
 */
import { z } from 'zod';

export const StormProviderSchema = z.enum(['noaa', 'hailtrace', 'rooflink', 'openweathermap', 'nws']);
export type StormProvider = z.infer<typeof StormProviderSchema>;

export const StormLocationSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  radiusKm: z.number().positive().optional(),
});
export type StormLocation = z.infer<typeof StormLocationSchema>;

export const StormQueryCompletedEvent = z.object({
  event: z.literal('storm.query.completed'),
  queryId: z.string().uuid(),
  providers: z.array(StormProviderSchema),
  location: StormLocationSchema,
  from: z.string().datetime(),
  to: z.string().datetime(),
  eventCount: z.number().int().nonnegative(),
  cacheHit: z.boolean(),
  at: z.string().datetime(),
});
export type StormQueryCompleted = z.infer<typeof StormQueryCompletedEvent>;

export const StormEventMatchedEvent = z.object({
  event: z.literal('storm.event.matched'),
  queryId: z.string().uuid(),
  eventId: z.string(),
  provider: StormProviderSchema,
  eventType: z.string(),
  location: StormLocationSchema,
  occurredAt: z.string().datetime(),
  hailSizeInches: z.number().nonnegative().optional(),
  windSpeedMph: z.number().nonnegative().optional(),
  raw: z.unknown(),
});
export type StormEventMatched = z.infer<typeof StormEventMatchedEvent>;

export const StormCacheRefreshedEvent = z.object({
  event: z.literal('storm.cache.refreshed'),
  provider: StormProviderSchema,
  entriesRefreshed: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type StormCacheRefreshed = z.infer<typeof StormCacheRefreshedEvent>;

export const StormProviderDegradedEvent = z.object({
  event: z.literal('storm.provider.degraded'),
  provider: StormProviderSchema,
  reason: z.enum(['rate_limited', 'auth_failed', 'timeout', 'http_error', 'parse_error']),
  detail: z.string().optional(),
  at: z.string().datetime(),
});
export type StormProviderDegraded = z.infer<typeof StormProviderDegradedEvent>;

export const EVENT_NAMES = {
  queryCompleted: 'storm.query.completed',
  eventMatched: 'storm.event.matched',
  cacheRefreshed: 'storm.cache.refreshed',
  providerDegraded: 'storm.provider.degraded',
} as const;
