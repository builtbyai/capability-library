/**
 * og-unfurl-proxy contracts. Cloudflare Worker port that spoofs a desktop
 * Chrome UA in front of bot-challenged upstreams so social crawlers can fetch
 * Open Graph tags. Events surface request flow + crawler detection + upstream
 * health for the dashboard and notify.
 */
import { z } from 'zod';

export const CrawlerNameSchema = z.enum([
  'Facebookexternalhit',
  'Twitterbot',
  'WhatsApp',
  'Discordbot',
  'LinkedInBot',
  'Slackbot',
  'TelegramBot',
  'other',
]);
export type CrawlerName = z.infer<typeof CrawlerNameSchema>;

export const OgProxyRequestInterceptedEvent = z.object({
  event: z.literal('og-proxy.request.intercepted'),
  requestId: z.string().uuid(),
  /** The URL the proxy is fetching from the upstream. */
  url: z.string().url(),
  upstreamHost: z.string(),
  /** UA the proxy spoofed toward the upstream (not the inbound UA). */
  spoofedUserAgent: z.string(),
  /** Inbound UA from the client/crawler hitting the proxy. */
  inboundUserAgent: z.string(),
  at: z.string().datetime(),
});
export type OgProxyRequestIntercepted = z.infer<typeof OgProxyRequestInterceptedEvent>;

export const OgProxyCrawlerDetectedEvent = z.object({
  event: z.literal('og-proxy.crawler.detected'),
  requestId: z.string().uuid(),
  crawler: CrawlerNameSchema,
  /** Raw UA the detection matched on. */
  userAgent: z.string(),
  url: z.string().url(),
  at: z.string().datetime(),
});
export type OgProxyCrawlerDetected = z.infer<typeof OgProxyCrawlerDetectedEvent>;

export const OgProxyUpstreamFailedEvent = z.object({
  event: z.literal('og-proxy.upstream.failed'),
  requestId: z.string().uuid(),
  url: z.string().url(),
  upstreamHost: z.string(),
  /** HTTP status the upstream returned, if any. */
  status: z.number().int().optional(),
  reason: z.enum([
    'timeout',
    'tcp-error',
    'bot-challenge',
    'forbidden',
    'not-found',
    'tls-error',
    'unknown',
  ]),
  error: z.string(),
  at: z.string().datetime(),
});
export type OgProxyUpstreamFailed = z.infer<typeof OgProxyUpstreamFailedEvent>;

export const EVENT_NAMES = {
  requestIntercepted: 'og-proxy.request.intercepted',
  crawlerDetected: 'og-proxy.crawler.detected',
  upstreamFailed: 'og-proxy.upstream.failed',
} as const;
