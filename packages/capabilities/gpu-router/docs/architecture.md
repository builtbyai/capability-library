# gpu-router · architecture

```
poller (every GPU_ROUTER_POLL_INTERVAL_MS, default 30s):
  for each host in fleet:
    ssh/HTTP query: nvidia-smi --query-gpu=index,name,memory.total,memory.used,utilization.gpu,temperature.gpu --format=csv
                     OR rocm-smi --json
    fetch loaded models from $host:11434/api/ps
    estimate queue depth from $host:11434/api/queue (or 0 if unavailable)
  bus.emit('gpu.snapshot', { snapshots: [...] })

route(req):
  candidates = snapshots
    .filter(s => freeVram(s) >= req.vramRequiredMb)
    .filter(s => !req.requireVendor || s.vendor === req.requireVendor)
  if (!candidates.length) {
    overloaded = snapshots.filter(s => freeVram(s) < req.vramRequiredMb)
    overloaded.forEach(s => bus.emit('gpu.host.overloaded', {host: s.host, ...}))
    return null
  }
  score = candidate => freeVramScore(c) - queueScore(c) + loadedModelBonus(c) - latencyScore(c)
  winner = candidates.max(score)
  bus.emit('gpu.routed', { decision: { selectedHost, gpuIndex, reason } })
  return winner

rebalance():
  // Optionally evict cold models from saturated hosts via Ollama keep_alive=0.
  // Lazy; opt-in. Default no-op.
```

## Cold-load bonus calculation

If `req.modelId` matches a `loadedModels` entry on a candidate, add a +1000 bonus to its score. Loading a 32B model from disk takes 5-30s; keeping the same host for a session pays back N times over.
