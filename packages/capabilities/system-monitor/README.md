# system-monitor · _planned_

CPU / RAM / network / storage telemetry widgets + process manager + service control. Consumes `fleet-control.health` per machine; per-host widgets show fleet-wide load at a glance. Sourced from dashboard_v5 monitoring + process-manager + system-services widgets.

**Surfaces:** CpuChart, MemoryChart, NetworkChart, StorageChart, ProcessTable, ServiceTable, SystemAlertsPanel
**Emits:** `sysmon.alert.cpu-spike`, `sysmon.alert.memory-pressure`, `sysmon.alert.disk-full`, `sysmon.process.killed`, `sysmon.service.restarted`
**Jobs:** `system-monitor:rollup-snapshot`, `system-monitor:cleanup-tmp`, `system-monitor:kill-process`
**Depends on:** fleet-control, notify

See `docs/sharp-edges.md` for project-specific landmines.
