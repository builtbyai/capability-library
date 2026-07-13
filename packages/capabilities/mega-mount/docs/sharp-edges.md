# mega-mount · sharp edges

## 1. rclone+mega backend native is broken

Per `rclone_mega_backend_broken.md`, `type=mega` rclone remote fails "unexpected end of JSON input" against current Mega API. MUST use MEGAcmd->WebDAV indirection.

## 2. whoami can hang silently

Per `mega_mount_hang_pattern.md`, MEGAclient IPC can hang for minutes. Wrap every call in `timeout 30s`; on timeout, hard-kill and restart.

## 3. Obscured passwords cannot be re-obscured

Per `rclone_obscure_double_obscure_gotcha.md`, copying a password between machines requires `rclone reveal` first; double-obscure silently corrupts.

## 4. 15-min watchdog cadence is the proven floor

node-a + node-b have `RcloneMegaWatchdog` scheduled tasks at 15min intervals. Shorter intervals cause restart loops during slow login flows.

