# ai-orchestration · architecture

```
OrchRequest { strategy, prompt, fanout, angles?|agents?|models?, judge?, capabilityId }
        │
        ▼
strategy dispatcher:
   ┌─ parallel-think ────► spawn fanout × ModelInvocation calls (different prompts per angle)
   ├─ parallel-synthesis ► spawn fanout × ModelInvocation calls (research-style per agent)
   ├─ devils-advocate ───► one call (generate), then one call (adversarial critique)
   └─ multi-model-consensus → same prompt to N models in parallel
        │
        ▼
emit orch.angle.completed per angle
        │
        ▼
judge phase: ModelInvocation call with judge.mode (merge | pick-best | critique)
        │
        ▼
emit orch.synthesis.completed + orch.run.completed
```

Cost accounting: every angle + the judge call records to `CostLedger` with `capabilityId` from the request (so a workflow's cost is attributed to the workflow, not to `ai-orchestration` itself).

## Fanout safety

`AI_ORCH_MAX_PARALLEL` caps the global concurrent ModelInvocation calls. Without it, parallel-think with fanout=5 across 4 simultaneous runs spawns 20 in-flight calls — exceeds DeepSeek's per-token QPS. Default cap: 8.
