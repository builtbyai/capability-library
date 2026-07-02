# gpu-router · diagnostics runbook

## Rung 1 — fleet snapshot

```bash
curl http://127.0.0.1:5121/api/gpu/snapshot
```

Expect ≥1 GPU entry per reachable host. Missing entries = nvidia-smi/rocm-smi unavailable on that host.

## Rung 2 — routing fairness

```bash
curl 'http://127.0.0.1:5121/api/gpu/routing-history?window=1h'
```

If one host has >70% of routes despite ≥2 healthy hosts, the policy is sticky on cold-load bonus and isn't releasing models. Trigger `POST /api/gpu/route` with `vramRequiredMb` larger than that host's free VRAM to force re-evaluation.

## Rung 3 — cold-load smoke

```bash
curl -X POST http://127.0.0.1:5121/api/gpu/route \
  -d '{"workload":"inference-small","vramRequiredMb":1000,"modelId":"qwen2.5-coder:7b","capabilityId":"test"}'
```

Should return a host. Re-run; the second route should hit the same host (cold-load bonus). Re-run with a different `modelId`; should still prefer same host if VRAM free.

## Symptom → cause

| Symptom | Cause |
|---|---|
| Routes always go to BBWADMIN | Cold-load bonus too high OR jmint/jmain unreachable. Check fleet-control. |
| Routes flap between hosts | VRAM samples mid-swap (sharp-edges #1). Average more samples. |
| jmint route returns instantly but inference is slow | ROCm CPU fallback (sharp-edges #2). Use a different model. |
| OOM on BBWADMIN after a route | Two 32B models loaded; eviction missing (sharp-edges #4). |
| JMAIN routes take >50ms RTT | Tailscale instead of direct (sharp-edges #5). |
