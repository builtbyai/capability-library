# ai-orchestration · diagnostics runbook

## Rung 1 — model pool

`GET /api/orch/_pool` returns the list of registered ModelInvocation adapters + their last ping. At least 2 reachable required (for consensus). If only 1, multi-model-consensus throws at request time with a clear message.

## Rung 2 — fixture parallel-think

```bash
curl -X POST http://127.0.0.1:5113/api/orch/parallel-think \
  -d '{"prompt":"how many sides does a triangle have?","fanout":2,"capabilityId":"test"}'
```

Expect 200 + `{ runId, angles: [2 items], synthesis: '... 3 ...' }`. Trivially-correct fixture proves the wiring.

## Rung 3 — cost trail

`GET /api/orch/runs/:runId` returns angles + judge + total cost. Verify that totalCostUSD ≈ Σ(angle.costUSD) + judge.costUSD. Mismatch indicates CostLedger attribution drift.

## Symptom → cause

| Symptom | Cause |
|---|---|
| Cost spike from a single run | Fanout × concurrent (sharp-edges #1). Lower `AI_ORCH_MAX_PARALLEL`. |
| Judge always picks the longest answer | Sharp-edges #2. Lower per-angle token cap. |
| "Consensus" reached but answer wrong | All models same vendor (sharp-edges #3). Diversify. |
| Adversarial critique invents counter-facts | Sharp-edges #4. Add fact-check post-pass. |
| Codex result missing | Fire-and-forget (sharp-edges #5). Check `.claude/codex-handoff/`. |
