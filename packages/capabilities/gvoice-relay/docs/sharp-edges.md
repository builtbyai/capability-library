# gvoice-relay · sharp edges

## 1. Test recipients are strictly enforced

Per `gvoice_relay_test_recipients.md`: ONLY +19727627970 (in+out) and +14693160530 (out only). Never test other numbers - throttle hits have happened.

## 2. Chip-commit pattern is load-bearing

Per `gvoice_relay_chip_commit_fix.md`: compose-To must type raw 10 digits + click matching dropdown option. +1 prefix breaks GV detector.

## 3. Own-domain blocklist must stay current

Signup emails to onlyjalen.com bounce because no MX. Maintain a per-domain blocklist per `onlyjalen_smtp_bounces.md`.

## 4. Puppeteer profile bytes are sensitive

Profile dir holds active Google session cookies. Treat as privileged secret; never sync to cloud.

## 5. Inbound poll cadence vs Google throttle

Polling more than 1x/min triggers Google "unusual activity" challenge. Keep cron at 1m minimum; back off on 429.

