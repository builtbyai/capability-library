/**
 * paypal-payments contracts. PayPal OAuth2 + subscriptions + products + plans +
 * one-time orders + webhook verification. Sandbox/live env switch with cached-token
 * invalidation; emits semantic events whenever the payment graph mutates.
 */
import { z } from 'zod';

export const PaypalEnvSchema = z.enum(['sandbox', 'live']);
export type PaypalEnv = z.infer<typeof PaypalEnvSchema>;

export const PaypalAmountSchema = z.object({
  currencyCode: z.string().length(3),
  value: z.string(),
});
export type PaypalAmount = z.infer<typeof PaypalAmountSchema>;

export const PaypalOrderCreatedEvent = z.object({
  event: z.literal('paypal.order.created'),
  orderId: z.string(),
  env: PaypalEnvSchema,
  intent: z.enum(['CAPTURE', 'AUTHORIZE']).default('CAPTURE'),
  amount: PaypalAmountSchema,
  at: z.string().datetime(),
});
export type PaypalOrderCreated = z.infer<typeof PaypalOrderCreatedEvent>;

export const PaypalOrderCapturedEvent = z.object({
  event: z.literal('paypal.order.captured'),
  orderId: z.string(),
  captureId: z.string(),
  env: PaypalEnvSchema,
  amount: PaypalAmountSchema,
  payerId: z.string().optional(),
  at: z.string().datetime(),
});
export type PaypalOrderCaptured = z.infer<typeof PaypalOrderCapturedEvent>;

export const PaypalSubscriptionActivatedEvent = z.object({
  event: z.literal('paypal.subscription.activated'),
  subscriptionId: z.string(),
  planId: z.string(),
  env: PaypalEnvSchema,
  subscriberId: z.string().optional(),
  startTime: z.string().datetime(),
  at: z.string().datetime(),
});
export type PaypalSubscriptionActivated = z.infer<typeof PaypalSubscriptionActivatedEvent>;

export const PaypalSubscriptionCancelledEvent = z.object({
  event: z.literal('paypal.subscription.cancelled'),
  subscriptionId: z.string(),
  env: PaypalEnvSchema,
  reason: z.string().optional(),
  at: z.string().datetime(),
});
export type PaypalSubscriptionCancelled = z.infer<typeof PaypalSubscriptionCancelledEvent>;

export const PaypalWebhookReceivedEvent = z.object({
  event: z.literal('paypal.webhook.received'),
  webhookEventId: z.string(),
  env: PaypalEnvSchema,
  eventType: z.string(),
  resourceType: z.string().optional(),
  raw: z.unknown(),
  at: z.string().datetime(),
});
export type PaypalWebhookReceived = z.infer<typeof PaypalWebhookReceivedEvent>;

export const PaypalWebhookVerifiedEvent = z.object({
  event: z.literal('paypal.webhook.verified'),
  webhookEventId: z.string(),
  env: PaypalEnvSchema,
  verified: z.boolean(),
  reason: z.string().optional(),
  at: z.string().datetime(),
});
export type PaypalWebhookVerified = z.infer<typeof PaypalWebhookVerifiedEvent>;

export const PaypalTokenRefreshedEvent = z.object({
  event: z.literal('paypal.token.refreshed'),
  env: PaypalEnvSchema,
  expiresAt: z.string().datetime(),
  at: z.string().datetime(),
});
export type PaypalTokenRefreshed = z.infer<typeof PaypalTokenRefreshedEvent>;

export const EVENT_NAMES = {
  orderCreated: 'paypal.order.created',
  orderCaptured: 'paypal.order.captured',
  subscriptionActivated: 'paypal.subscription.activated',
  subscriptionCancelled: 'paypal.subscription.cancelled',
  webhookReceived: 'paypal.webhook.received',
  webhookVerified: 'paypal.webhook.verified',
  tokenRefreshed: 'paypal.token.refreshed',
} as const;
