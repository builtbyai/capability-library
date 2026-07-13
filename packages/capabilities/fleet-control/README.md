# fleet-control · _planned_

Unified control surface for the 3-PC fleet: **node-a** (Windows, local), **node-b** (Windows, 10.0.0.2 direct-link / 192.168.1.216 LAN), **node-c** (Linux Mint, 192.168.1.71 / 192.168.1.70).

**Surfaces:** FleetDashboard, MachineCard, ServiceStatusGrid, GuiActionPanel, FleetMetricsChart
**Emits:** `fleet.machine.unreachable`, `fleet.machine.recovered`, `fleet.service.failed`, `fleet.gui.action.completed`, `fleet.metrics.snapshot`
**Depends on:** connector-config, notify

## Consolidates 8 skills

`gui-node-a`, `gui-node-b`, `gui-node-c`, `fleet-health`, `fleet-pipeline`, `fleet-recover`, `fleet-delegate`, `machine-profile`. Each one rebuilt:
- machine identity detection (hostname → role mapping)
- service status query (Windows scheduled tasks / NSSM / systemd)
- GUI dispatch via the port-9900 stream server
- RAM / disk / Ollama health snapshot

## Port-9900 stream servers

Per `fleet_gui_stream_server.md`, each PC runs a GUI control server on `0.0.0.0:9900`. Direct links:
- node-a: `127.0.0.1:9900` local; `10.0.0.2:9900` from node-b; `192.168.1.232:9900` from node-c
- node-b: `10.0.0.2:9900` direct; `192.168.1.216:9900` LAN
- node-c: `192.168.1.70:9900` LAN

## Service identifiers

Different OS conventions stay native; the capability just normalizes the state enum:
- Windows: scheduled task id OR NSSM service name (e.g. `node-aBroker`, `Ollama`, `gvoice-relay`)
- Linux: systemd unit (e.g. `node-c-stream.service`, `sunshine-arp-pin.service`, `ollama.service`)
