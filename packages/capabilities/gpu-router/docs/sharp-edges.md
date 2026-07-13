# gpu-router · sharp edges

## 1. VRAM "available" from nvidia-smi lies during transient model swap

`memory.used` updates after the swap completes. A naive query during the 2-3s swap window sees stale numbers and routes a new request to a host that's actually full. Average over 3 consecutive samples (or use `--query-compute-apps` for active processes) before deciding.

## 2. AMD ROCm + Ollama is flaky on AMD Tahiti

node-c's GPU is old enough that Ollama's ROCm backend falls back to CPU silently for some models. The router must consult `ollama ls --gpu` (or equivalent) to see which models actually loaded into VRAM vs CPU — a model on AMD CPU is no better than on a different host's CPU.

## 3. Queue depth from /api/ps is approximate

Ollama doesn't expose true queue depth in pre-v0.4. Estimate by counting in-flight `/api/generate` requests via the local nginx/reverse-proxy log if any, OR fall back to "0 = OK, anything else = unknown busy" heuristic. Underestimating queue depth = thrashing.

## 4. Cold load on a 32B model evicts whatever was hot

Per `node-a_ollama_store.md`, node-a holds qwq/deepseek-r1/qwen2.5vl at 32B (~20GB each). Loading two 32B models simultaneously OOMs. The router must respect `loadedModels` count + total VRAM AND choose to evict explicitly (via `keep_alive: 0`) before cold-loading another large model.

## 5. Routing to node-b over Tailscale defeats the speedup

Per `bbw_pcc_direct_link.md` + node-b identity ambiguity: if the router resolves node-b's address to Tailscale (`100.x.x.x`), inference round-trip adds 50ms+ per request. ALWAYS prefer direct-link `10.0.0.2` when the calling host is node-a.

## 6. Health snapshots leak across machine restarts

If node-b restarts at 02:00 with a fresh 0% VRAM, the router's cache still says "90% used" until the next poll. Snapshots MUST have a TTL ≤ poll interval, and a missed-poll counter; 2 missed polls = invalidate.
