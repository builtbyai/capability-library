# ai-orchestration · sharp edges

## 1. Fanout × concurrent runs explodes cost

A workflow firing parallel-think with fanout=5 spawns 6 ModelInvocation calls (5 angles + 1 judge) per request. Three concurrent workflows = 18 calls. Cap with `AI_ORCH_MAX_PARALLEL` AND emit a `cost.recorded` for every angle so notify-on-cost-spike can catch runaways.

## 2. Judge bias toward verbose angles

The merge-style judge tends to over-weight the longest angle. Pre-trim each angle to a max token budget (e.g. 800 tokens) before passing to the judge. The pick-best judge has the opposite problem: picks the most confident-sounding angle, which is often the adversarial one.

## 3. Multi-model-consensus is meaningless if all models share a backbone

Three Anthropic models (opus, sonnet, haiku) agreeing isn't consensus — it's correlated error. For real cross-validation, use ONE Anthropic + ONE OpenAI + ONE open-source (ollama). The capability must surface a `correlation_warning` if all `models[]` share a vendor.

## 4. Devils-advocate amplifies hallucination

The adversarial pass can argue against correct claims with fabricated counter-evidence. Always pass the critique through a fact-check pass (e.g. requires-citations mode) before showing it to a human as "the model said X is wrong."

## 5. Codex handoff is fire-and-forget

When the codex-yolo hook intercepts a parallel-think prompt, Codex runs in a background process the capability doesn't manage. Don't await the Codex result in `parallelThink()` — emit `orch.angle.completed{provider:'codex'}` lazily when the codex-handoff file shows up, OR ignore Codex entirely from the capability's perspective (let workflow listeners catch it separately).
