# whatsapp-bridge · sharp edges

## 1. Test recipients are pre-approved — don't broadcast

Per the user's memory `test-allowlist`, only `+15555550100` (in+out) and `+15555550101` (out only) are safe for outbound testing. **Never** test against arbitrary numbers — unsolicited sends risk provider throttling. The capability must enforce a `WHATSAPP_TEST_ALLOWLIST` in non-prod environments and refuse sends to off-list recipients.

## 2. Business session window — 24h rule

Outbound free-form messages outside a 24h window from the recipient's last inbound require pre-approved templates. Status check the chat's `lastInboundAt` before sending; if expired, surface a clear `delivery.failed{reason:'outside_session_window'}` instead of letting the provider return a confusing 400.

## 3. Group chat IDs differ across backends

MCP-bridge uses `<group-id>@g.us`; Postiz uses an internal numeric id. The capability MUST normalize to a single canonical form (`group:<sha1(participants)>`) at the contract boundary. Otherwise downstream consumers will fail to match group chats across backends.

## 4. Media bytes are NOT in the message — they're a lazy URL

Both backends return media as a URL that expires in ~1 hour. The capability MUST download bytes inside the receive handler and stage them via `intake-pipeline` before the URL expires. Lazy fetch on consumer demand will 404.

## 5. Contact-search privacy

`searchContacts` exposes the user's contact graph. The endpoint must require an authenticated session and never log the result set. Logs go through a redactor that masks phone numbers to last-4.
