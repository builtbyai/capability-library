# paypal-payments · sharp edges

## 1. Mode switch must invalidate cached token

Switching sandbox<->live without clearing the OAuth2 access token = silent 401s on every subsequent call. The `paypal_set_mode` impl in paypal-mcp-server already does this; copy that behavior verbatim.

## 2. Webhook signature verification is per-environment

Sandbox webhook IDs differ from live. Verifying a live webhook with sandbox key returns "verified: false" with no useful error. Surface the env mismatch as a distinct error code.

## 3. Token TTL is 8h but caching past 7h causes 401 race

PayPal returns `expires_in: 32400` (9h). Cache for 7h to give yourself a safe window. Refresh proactively at 6h via a scheduler cron, NOT lazily on next request.

## 4. Subscription state transitions are not idempotent

Calling `subscriptions/.../cancel` twice returns 422 the second time. The cap MUST check state before transition; emit `paypal.subscription.cancelled` only on the 2xx response, never on 4xx.

## 5. Order capture must include the order ID in BOTH path AND header

PayPal's API rejects with 422 if `PayPal-Request-Id` doesn't match the order being captured. Use the order ID as both.

