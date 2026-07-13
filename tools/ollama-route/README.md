# tools/ollama-route

Pick the least-loaded healthy Ollama instance across the fleet (node-a, node-b, node-c). Prints the winning URL on stdout; logging on stderr (so it composes into shell pipelines).

## Run

```bash
# Use winner's URL as OLLAMA_HOST for the next command
export OLLAMA_HOST=$(node tools/ollama-route/route.mjs)
ollama run qwen2.5-coder:7b "..."

# Full breakdown
node tools/ollama-route/route.mjs --json

# Require a specific model on the chosen host
node tools/ollama-route/route.mjs --require-model qwen2.5vl:32b
```

## Scoring

Lower wins:
1. `--require-model`: hard filter (host without the model is dropped)
2. `inflight` request count (from `/api/ps`)
3. RTT to `/api/tags`

If `--require-model` is unsatisfied across all hosts, exits non-zero. Caller can then either pull the model on the lowest-cost host or fall back to a cloud provider.

## Differences from `gpu-router` capability

- No VRAM headroom check (use the cap for that)
- No bus events, no cost-ledger
- Synchronous + minimal — designed for shell wrapper composition
