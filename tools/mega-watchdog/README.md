# tools/mega-watchdog

Periodic health check on the Mega `rclone+MEGAcmd→WebDAV` mount. Triggers restart on hang detection. Standalone version of the `mega-mount` capability's watchdog step; usable as a scheduled task without spinning up the cap.

## Run

```bash
# Windows (default mount: Y:)
node tools/mega-watchdog/watchdog.mjs --mount Y:

# Linux (jmint default)
node tools/mega-watchdog/watchdog.mjs \
  --mount /mnt/mega \
  --restart-cmd "systemctl --user restart mega-mount"

# Dry run — probe but don't restart
node tools/mega-watchdog/watchdog.mjs --dry-run
```

Exit codes: `0` healthy, `2` hung (restarted if `--restart-cmd`), `3` restart command itself failed.

## Why a tool, not just inside the cap

Two reasons:
1. The watchdog runs as a Windows scheduled task (`RcloneMegaMount` / `RcloneMegaWatchdog`) — those tasks need a single executable, not a capability process.
2. Cross-machine: BBWADMIN, JMAIN, and jmint all run a watchdog. The tool ships with the library so all 3 PCs install one copy.

## Cron cadence

Per user memory: **15 minutes is the proven floor**. Shorter intervals cause restart loops during slow login flows.

```cron
*/15 * * * * /usr/bin/node /path/to/tools/mega-watchdog/watchdog.mjs --mount /mnt/mega --restart-cmd "systemctl --user restart mega-mount"
```
