# Fable 5 Field Reports and Evidence Register

## Purpose

This document adds the user-supplied field reports to the KB without turning anecdotes into unsupported facts. Treat it as an evidence register for **what users reported Fable-like agents felt capable of doing**, and as a source of harness requirements for DeepSeek V4 + Claude Code.

The practical question is not "can we clone Fable?" The useful engineering question is:

> Which observable behaviors made Fable 5 feel qualitatively better, and which of those behaviors can be recreated through model routing, subagents, tools, memory, verification, and cost controls?

## Evidence hierarchy

| Evidence class | Examples | How to use it |
|---|---|---|
| Official provider claims | Anthropic launch post, system card, API docs, suspension notices | Use for model names, API behavior, pricing, availability, safety posture. |
| Direct named field reports | Jonathan Fulton, Simon Willison | Use as credible but still non-controlled reports of real workflows. |
| Community reports | Reddit threads, forum notes, Discord/X comments | Use as pattern signals, never as proof. |
| Speculation | claims about hidden architecture, looped transformers, orchestration layers | Convert into harness design hypotheses only. Mark as unverified. |

## Added source material

### 1. Jonathan Fulton — short review of Fable 5

The added Medium review is a direct user report from Jonathan Fulton. The key reported tests were:

- a Lyfetime.io-style financial planning app with many forms and complicated simulation math;
- a Linear.app-style clone;
- a Notion-style clone;
- a large open-source migration: porting `sqlglot`, a roughly 100k-line Python SQL parser, to Go;
- a head-to-head comparison between Fable 5 through Claude Code and GPT 5.5 through Codex;
- reported Fable behavior: long continuous execution, parallel subagent fan-out, systematic implementation, and a high pass rate on the resulting port;
- reported tradeoff: high cost and slower raw token output, but faster end-to-end task completion for complex work.

**KB interpretation:** this report strengthens the case for a long-horizon agent harness with explicit planning files, fan-out workers, deterministic verification, and cost caps.

### 2. Simon Willison — initial Fable 5 impressions

The uploaded Simon Willison clipping reports Fable 5 as slow, expensive, and unusually capable on hard tasks. It highlights the public model attributes that matter for routing: 1M context, 128k maximum output, high pricing, and availability across Claude surfaces at launch.

The most actionable portion is the Datasette Agent / LLM work: Fable helped implement a human-in-the-loop tool-call pause/resume mechanism, including `tool_call_id` handling, `PauseChain`, sibling tool-call semantics, and resuming from unresolved tool calls.

**KB interpretation:** Fable-style agents need a first-class pause/resume protocol, not just a simple "call tool then continue" loop.

### 3. Reddit / LLMDevs — "what made Mythos and Fable better?"

The LLMDevs thread is mostly speculation. The recurring hypothesis is that the improvement is not merely raw model weights but a hidden or explicit **orchestration layer**: self-evaluation, repeated internal attempts, tool-aware planning, confidence checks, and post-training from successful agent traces.

**KB interpretation:** do not claim this is how Fable works internally. Use it as a design prompt: build visible orchestration outside the model so DeepSeek V4 can benefit from deterministic loops.

### 4. Reddit / r/claude — Fable as default vs routed model

The r/claude thread contains enthusiasm and pushback. Supporters describe Fable as better at flow logic and user-intent reasoning. Critics argue that using a frontier model for every task wastes tokens, and that lighter models should handle simpler work.

**KB interpretation:** the right pattern is not "one model for everything." The right pattern is **frontier planner + cheaper executor/reviewer/scout agents**, with automatic routing and explicit task budgets.

### 5. Reddit / r/ClaudeAI — better but not always revolutionary

The r/ClaudeAI thread is useful because it adds negative evidence. It reports high token burn, occasional long silent loops, compaction/context-management concerns, and skepticism that Fable always rethinks bad abstractions. Several comments also emphasize the need for controlled experiments rather than vibe-based comparisons.

**KB interpretation:** Fable-style autonomy must include checkpointing, stuck-loop detection, bounded context, reviewer gates, and repeated evals.

## Consolidated capability signals

| Signal | Field-report pattern | Harness requirement |
|---|---|---|
| Sustained execution | agents working for hours without stopping | mission file, run log, heartbeat checkpoint, stop rule |
| Parallel decomposition | multiple pages/modules/subagents built in parallel | task graph, subagent registry, merge protocol |
| Better user-intent reasoning | catches wrong screen/flow, not just visual mismatch | user-journey invariants and E2E acceptance tests |
| Tool fluency | browser, staging, screenshots, live traces, APIs | tool affordance map and permission tiers |
| Self-correction | stops theorizing and checks real data | evidence-before-theory loop |
| Large-context durability | handles long tasks past typical context failure | memory files, compaction summaries, context budget |
| Cost burn | expensive long runs and high token use | budget caps, route-to-cheaper-model, stop/replan |
| Overreach | changes artifacts that were not requested | narrow diff contract and overreach detector |
| Slop risk | working code can still degrade architecture | adversarial review and architecture invariants |
| Model/harness ambiguity | users cannot separate model ability from Claude Code behavior | eval fixtures with identical tools and prompts |

## Claims to avoid

Do **not** write these into production docs as facts:

- "Fable is primarily an orchestration model."
- "Fable uses a looped transformer."
- "Fable has X trillion parameters."
- "DeepSeek can match Fable if prompted correctly."
- "A single successful field report proves model superiority."

Safe phrasing:

- "Several user reports describe behavior consistent with strong long-horizon orchestration."
- "The internal architecture is not public; this KB recreates observable workflow behavior through explicit harness design."
- "Use controlled evals before adopting any routing policy."

## Distilled engineering thesis

A Fable-like agent stack is not just a stronger model. It is a runtime made of:

```text
frontier planner
+ scoped subagents
+ explicit mission memory
+ tool affordance map
+ pause/resume tool protocol
+ live verification
+ adversarial review
+ cost/context budgets
+ safety and permission routing
+ final proof trail
```

That is the part we can implement with Claude Code and DeepSeek V4.
