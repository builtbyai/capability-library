# fleet-control · diagnostics runbook

## Rung 1 — machine identity

```bash
curl http://127.0.0.1:5120/api/fleet/machines
```

Expect 3 entries with `hostname`, `os`, `ip`, `guiUrl`. If only 1-2, the offline machines are unreachable on all known addresses.

## Rung 2 — port-9900 reachability per host

```bash
curl --max-time 2 http://127.0.0.1:9900/api/ping        # node-a
curl --max-time 2 http://10.0.0.2:9900/api/ping        # node-b
curl --max-time 2 http://192.168.1.70:9900/api/ping      # node-c
```

Failure on node-a suggests Hyper-V port reservation (sharp-edges #1). Failure on node-b suggests Tailscale routing (sharp-edges #2).

## Rung 3 — Ollama presence

```bash
curl --max-time 3 http://127.0.0.1:11434/api/tags   # node-a
curl --max-time 3 http://10.0.0.2:11434/api/tags   # node-b
curl --max-time 3 http://192.168.1.71:11434/api/tags # node-c
```

At least one MUST respond for AI-orchestration / fleet-dispatch to work.

## Symptom → cause

| Symptom | Cause |
|---|---|
| node-a GUI not responding | Hyper-V port reservation (sharp-edges #1) |
| node-b slow GUI dispatch | Tailscale routing instead of direct link (sharp-edges #2) |
| node-c CPU at 100% idle | ACPI storm (sharp-edges #3); check gpe16 mask |
| All NSSM services show `failed` | False positive on Disabled scheduled tasks (sharp-edges #4) |
| Streaming disconnects 15-45s into session | ARP staleness on node-c (sharp-edges #6); verify sunshine-arp-pin service |
