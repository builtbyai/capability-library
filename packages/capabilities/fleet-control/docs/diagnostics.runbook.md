# fleet-control · diagnostics runbook

## Rung 1 — machine identity

```bash
curl http://127.0.0.1:5120/api/fleet/machines
```

Expect 3 entries with `hostname`, `os`, `ip`, `guiUrl`. If only 1-2, the offline machines are unreachable on all known addresses.

## Rung 2 — port-9900 reachability per host

```bash
curl --max-time 2 http://127.0.0.1:9900/api/ping        # bbwadmin
curl --max-time 2 http://10.10.10.2:9900/api/ping        # jmain
curl --max-time 2 http://192.168.0.70:9900/api/ping      # jmint
```

Failure on BBWADMIN suggests Hyper-V port reservation (sharp-edges #1). Failure on JMAIN suggests Tailscale routing (sharp-edges #2).

## Rung 3 — Ollama presence

```bash
curl --max-time 3 http://127.0.0.1:11434/api/tags   # bbwadmin
curl --max-time 3 http://10.10.10.2:11434/api/tags   # jmain
curl --max-time 3 http://192.168.0.71:11434/api/tags # jmint
```

At least one MUST respond for AI-orchestration / fleet-dispatch to work.

## Symptom → cause

| Symptom | Cause |
|---|---|
| BBWADMIN GUI not responding | Hyper-V port reservation (sharp-edges #1) |
| JMAIN slow GUI dispatch | Tailscale routing instead of direct link (sharp-edges #2) |
| jmint CPU at 100% idle | ACPI storm (sharp-edges #3); check gpe16 mask |
| All NSSM services show `failed` | False positive on Disabled scheduled tasks (sharp-edges #4) |
| Streaming disconnects 15-45s into session | ARP staleness on jmint (sharp-edges #6); verify sunshine-arp-pin service |
