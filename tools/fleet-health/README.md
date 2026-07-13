# tools/fleet-health

Standalone fleet health checker. Pings node-a, node-b, node-c on each known address, probes port-9900 GUI server + 11434 Ollama. Single-command status across all 3 PCs.

## Run

```bash
node tools/fleet-health/check.mjs            # human-readable
node tools/fleet-health/check.mjs --json     # JSON for piping
```

Exit code: `1` if any host is fully DOWN, `0` otherwise.

## Output

```
FLEET HEALTH
============
[OK]   node-a   GUI:3ms                      OLLAMA:8ms(12 models)        via 127.0.0.1
[OK]   node-b      GUI:1ms                      OLLAMA:5ms(8 models)         via 10.0.0.2
[DOWN] node-c      GUI:DOWN                     OLLAMA:DOWN                  no address responded
```

## When to use

- Daily quick check
- Pre-deploy fleet readiness (does the target host actually exist?)
- After power blip / network change
- Cron-driven (`fleet-health-rollup` workflow) into the `notify` capability

For richer health (RAM, disk, service status, GPU telemetry), use the `fleet-control` capability — this tool is intentionally a one-liner.
