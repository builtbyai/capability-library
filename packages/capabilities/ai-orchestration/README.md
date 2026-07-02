# ai-orchestration · _planned_

Multi-strategy parallel reasoning patterns. The user's 5 reasoning skills (parallel-think, parallel-agent-synthesis, devils-advocate, multi-model-consensus, ai-router) all wrap `ModelInvocation` calls in a fanout-then-judge pattern. This capability gives them a stable port + bus events so workflows can compose them by name.

**Surfaces:** StrategyPicker, AngleViewer, ConsensusInspector, JudgeOutputPanel
**Emits:** `orch.run.started`, `orch.angle.completed`, `orch.synthesis.completed`, `orch.run.completed`, `orch.run.failed`
**Depends on:** deepseek-router (default ModelInvocation; can substitute any)

## Strategies

| Strategy | Pattern | When to use |
|---|---|---|
| `parallel-think` | N angles (adversarial, first-principles, empirical, inverted, risk-first) run in parallel; judge merges | Decision-making with genuine uncertainty |
| `parallel-agent-synthesis` | Fan out research questions to N agents; synthesizer merges findings | Open-ended research / "explore all options" |
| `devils-advocate` | Generate, then critique with an adversarial pass | High-stakes decisions; pre-mortem |
| `multi-model-consensus` | Same prompt to 3 different models; judge picks/merges | Cross-validate AI output for monetizable workflows |

## Codex handoff

Per the user's memory `codex_yolo_autodispatch.md`, parallel-think + parallel-agent-synthesis are pre-authorized to fan out to Codex via the codex-yolo hook. This capability owns the in-library orchestration; Codex dispatch happens at the workflow/hook layer, not here.
