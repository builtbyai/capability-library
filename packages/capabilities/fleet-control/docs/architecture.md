# fleet-control · architecture

```
FleetControlPort
        |
  ┌─────┼─────┬──────┐
  │     │     │      │
  v     v     v      v
identity health  services  gui
        │              │
        v              v
adapter per host       per-host GUI broker (port 9900 / SSH)
  - node-a: local PS + scheduled tasks + NSSM
  - node-b:    SSH or 10.0.0.2:9900 stream server
  - node-c:    SSH (jalen@192.168.1.71) + systemd

bus emissions:
  - on each unreachable -> fleet.machine.unreachable
  - on each recovery   -> fleet.machine.recovered (with downtimeMs)
  - on each health snapshot -> fleet.metrics.snapshot
```

## GUI dispatch path

The port-9900 servers accept JSON-over-HTTP for click/type/hotkey/screenshot/scroll. `FleetControlPort.dispatchGuiAction` builds the right URL per host and POSTs. For privileged actions on node-a, it routes through `node-aBroker` (the broker accepts a bearer token with scope-graded permissions).

## Health collection cadence

Default: 60s rolling snapshot per machine, cached. The `fleet-health-rollup` workflow runs this on a cron tick and emits `fleet.metrics.snapshot`. Direct callers of `getHealth(host)` hit the live endpoint, not the cache.
