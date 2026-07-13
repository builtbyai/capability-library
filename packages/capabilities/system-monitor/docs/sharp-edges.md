# system-monitor · sharp edges

## 1. Process kill on Windows requires admin for SYSTEM-owned PIDs

Per user memory `node-a_gui_broker_deployed.md`: admin actions need the scope-graded admin token (`gui-node-a-admin.token`). Non-admin tokens get a silent 403 on `/api/sysmon/processes/:pid/kill` for any process owned by NT AUTHORITY\SYSTEM.

## 2. CPU % on Windows polls 1000ms slower than Linux

Windows perf counter `\Processor(_Total)\% Processor Time` requires two reads 1s apart for the first measurement. Linux /proc/stat gives instant deltas. The poll interval MUST be ≥1500ms on Windows; smaller intervals produce zeros.

## 3. NSSM services vs scheduled tasks ambiguity

Per `node-a_nssm_services.md`, the same name (`Ollama`) can refer to both a Windows service AND a scheduled task. The cap MUST query both and dedupe; otherwise restarting "Ollama" might restart the wrong one.

## 4. Disk-full threshold is per-volume

Default 90% triggers an alert. But Y:\ (Mega mount) routinely shows 95% with no problem because remote storage. Skip the alert for known cloud-mount paths via an env exclusion list.

## 5. Process table refresh storm

Refreshing every 1s on a host with 600+ processes (node-a typical) burns 5-10% CPU just on the monitor. Default to 5s; user-configurable down to 2s; below 2s is rejected.

