# paypal-payments · _planned_

PayPal OAuth2 + subscriptions + products + plans + one-time orders + webhook verification. Sandbox/live env switch with cached-token invalidation. Sourced from `paypal-mcp-server` MCP exposing tools as a JSON-RPC server; this capability ports the same tool surface to the library port shape.

**Surfaces:** PayPalDashboard, SubscriptionsTable, OrdersTable, WebhookEventLog, EnvironmentSwitcher, ProductCatalog, PlanBuilder
**Emits:** `paypal.order.created`, `paypal.order.captured`, `paypal.subscription.activated`, `paypal.subscription.cancelled`, `paypal.webhook.received`, `paypal.webhook.verified`, `paypal.token.refreshed`
**Jobs:** `paypal-payments:capture`, `paypal-payments:verify-webhook`, `paypal-payments:sync-subscriptions`
**Depends on:** connector-config, notify

See `docs/sharp-edges.md` for project-specific landmines.
