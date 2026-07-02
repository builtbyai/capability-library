# gpu-router · _planned_

Route GPU-bound workloads to the least-loaded GPU across the fleet. Consolidates `ollama-route` + `remote-ollama-review` skills.

**Surfaces:** GpuStatusGrid, GpuRoutingPanel, GpuMemoryChart, ModelPoolViewer
**Emits:** `gpu.snapshot`, `gpu.routed`, `gpu.host.overloaded`
**Depends on:** fleet-control

## Fleet GPU profile

| Host | GPU | Vendor | VRAM | Use |
|---|---|---|---|---|
| BBWADMIN | RTX (per `bbwadmin_ollama_store.md`, hosts qwq/deepseek-r1/qwen2.5vl 32B models on G:) | NVIDIA/CUDA | high | Heavy inference; cloud-deep workloads |
| JMAIN | RTX | NVIDIA/CUDA | high | Mirror for racing + transcode |
| jmint | AMD Tahiti (`jmint_machine.md`) | AMD/ROCm | mid | Smaller models + transcode (NVENC unavailable) |

## Routing policy

The router picks a host by scoring:
- **VRAM headroom** (vramTotal - vramUsed) ≥ `vramRequiredMb` (hard filter)
- **Vendor constraint** (e.g. CUDA-only workloads exclude AMD)
- **Queue depth** (smaller = better, weight 0.4)
- **Already-loaded model** (huge bonus — avoids 5-30s cold load on 32B+ models)
- **Network latency** (BBWADMIN 0ms > JMAIN 1ms direct-link > jmint 2ms LAN, weight 0.2)

A "no host" decision (all hosts overloaded) emits `gpu.host.overloaded` for each overloaded host and returns null — caller decides to queue or fail.
