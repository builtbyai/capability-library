# mega-mount · _planned_

Mega cloud drive mount via rclone+MEGAcmd->WebDAV (BBWADMIN Y:, JMAIN Y:, jmint /mnt/mega). Watchdog included.

**Surfaces:** MountStatusCard, MountActionPanel, WatchdogLogViewer
**Emits:** `mega.mount.started`, `mega.mount.stopped`, `mega.mount.hung`, `mega.mount.recovered`
**Depends on:** fleet-control, notify

See `docs/sharp-edges.md` for project-specific landmines (encoded from user memories).
