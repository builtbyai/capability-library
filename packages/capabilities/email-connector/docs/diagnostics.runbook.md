# email-connector · diagnostics runbook

## Rung 1 — IMAP reachability
`tcp connect to each configured imap host:port` within 5s. Failure = network/DNS, not auth.

## Rung 2 — OAuth refresh
For each gmail account, refresh access token. Failure = sharp-edges #1 (Testing-mode 7-day cap) or revoked grant.

## Rung 3 — sync cursor progress
`compare lastUid per mailbox to 1h-ago lastUid`. Expect advance OR zero new mail. Stuck cursor with mail in mailbox = IMAP IDLE silently dropped (some providers @ 29min). Re-issue IDLE on a heartbeat.

## Symptom → cause
| Symptom | Cause |
|---|---|
| Sync stuck at 0 new | IDLE dropped. Check `email.sync.failed` events. |
| OAuth callback 401 | Two-layer JWT gate (see ImpactIQ memory). Confirm callback path in PUBLIC_ROUTES. |
| Same attachment imported 5× | Dedup using filename not hash (sharp-edges #4). |
