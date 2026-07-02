# fleet-control · _planned_

Unified control surface for the 3-PC fleet: **BBWADMIN** (Windows, local), **JMAIN** (Windows, 10.10.10.2 direct-link / 192.168.0.216 LAN), **jmint** (Linux Mint, 192.168.0.71 / 192.168.0.70).

**Surfaces:** FleetDashboard, MachineCard, ServiceStatusGrid, GuiActionPanel, FleetMetricsChart
**Emits:** `fleet.machine.unreachable`, `fleet.machine.recovered`, `fleet.service.failed`, `fleet.gui.action.completed`, `fleet.metrics.snapshot`
**Depends on:** connector-config, notify

## Consolidates 8 skills

`gui-bbwadmin`, `gui-jmain`, `gui-jmint`, `fleet-health`, `fleet-pipeline`, `fleet-recover`, `fleet-delegate`, `machine-profile`. Each one rebuilt:
- machine identity detection (hostname → role mapping)
- service status query (Windows scheduled tasks / NSSM / systemd)
- GUI dispatch via the port-9900 stream server
- RAM / disk / Ollama health snapshot

## Port-9900 stream servers

Per `fleet_gui_stream_server.md`, each PC runs a GUI control server on `0.0.0.0:9900`. Direct links:
- BBWADMIN: `127.0.0.1:9900` local; `10.10.10.2:9900` from JMAIN; `192.168.0.232:9900` from jmint
- JMAIN: `10.10.10.2:9900` direct; `192.168.0.216:9900` LAN
- jmint: `192.168.0.70:9900` LAN

## Service identifiers

Different OS conventions stay native; the capability just normalizes the state enum:
- Windows: scheduled task id OR NSSM service name (e.g. `BBWAdminBroker`, `Ollama`, `gvoice-relay`)
- Linux: systemd unit (e.g. `jmint-stream.service`, `sunshine-arp-pin.service`, `ollama.service`)
