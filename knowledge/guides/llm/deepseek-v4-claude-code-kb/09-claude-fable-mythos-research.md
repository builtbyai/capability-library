# Claude Fable / Mythos Research Notes

## Purpose

This file turns the supplied Anthropic launch extract into an engineering reference. The goal is not to copy Fable/Mythos as a model dependency. The goal is to extract the operating pattern that makes frontier coding agents useful:

- long-horizon autonomy
- strong reasoning on complex work
- vision/document understanding
- persistent memory
- specialized tool use
- explicit safeguards
- fallback routing
- auditability

## Source status

The uploaded text is an extracted copy of Anthropic's June 9, 2026 announcement for Claude Fable 5 and Claude Mythos 5. It also contains an update banner saying access became unavailable on June 12, 2026.

Verified public references to re-check before production decisions:

- Anthropic launch announcement: `https://www.anthropic.com/news/claude-fable-5-mythos-5`
- Anthropic access-suspension statement: `https://www.anthropic.com/news/fable-mythos-access`
- Claude model overview: `https://platform.claude.com/docs/en/about-claude/models/overview`
- Claude Mythos product page: `https://www.anthropic.com/claude/mythos`
- Claude Code Agent SDK: `https://code.claude.com/docs/en/agent-sdk/overview`

## What Anthropic publicly claims

The announcement describes Fable 5 and Mythos 5 as two configurations of the same underlying model. The distinction is policy and safeguards, not a completely separate model family:

| Surface | Public description | Access posture | Relevant lesson for this KB |
|---|---|---|---|
| Claude Fable 5 | General-use Mythos-class model with conservative safeguards | Public launch followed by access suspension notice | Use as a reference for safe high-autonomy model routing. |
| Claude Mythos 5 | Same underlying model with some safeguards lifted for trusted programs | Restricted / trusted access | Do not emulate lifted safeguards. Emulate verification and governance. |
| Claude Opus 4.8 fallback | Next-most-capable model used when Fable's classifiers trigger | General Opus-tier model | Build fallback routes instead of binary failure. |

## Publicly visible capability pattern

The public materials describe a model that is especially strong when the task is long, messy, and multi-step. For engineering purposes, that maps to this capability stack:

```text
Large context + adaptive reasoning
        ↓
Persistent notes / memory
        ↓
Tool loop: read → inspect → edit → verify
        ↓
Specialist delegation
        ↓
Safety classifiers / policy routing
        ↓
Final artifact with proof trail
```

## The "how it works" abstraction

The internal model architecture is not fully public. What is public is enough to design a comparable agent harness.

### 1. Long-horizon reasoning

Fable/Mythos are described as better on longer, more complex tasks. In an agent runtime, this requires more than raw model ability:

- a stable mission file
- a decomposition phase
- a state file for decisions already made
- a task queue
- a verification queue
- rollback notes
- explicit stop conditions

### 2. Adaptive thinking

The Claude model overview lists adaptive thinking as always on for Fable/Mythos and extended thinking as not exposed in the same way as older thinking controls. The operational takeaway is: do not depend on hidden reasoning visibility. Depend on visible artifacts:

- plans
- assumptions
- diffs
- tests
- invariants
- risk registers
- handoff notes

### 3. Tool-aware autonomy

The launch text emphasizes autonomous work. Claude Code exposes this through file tools, shell tools, web tools, hooks, MCP, subagents, sessions, and permissions. The agent should therefore be designed as a controlled executor, not a chat bot.

### 4. Memory improves performance

The launch text says persistent file-based memory improved performance in long-running game tasks. Translate that into repo files:

```text
.agent/
  mission.md
  decisions.md
  task-queue.md
  risk-register.md
  verification.md
  memory/
    domain.md
    codebase-map.md
    recurring-failures.md
```

The model should update these files only when they reduce future ambiguity.

### 5. Safeguards as routing, not just refusal

Fable's launch notes describe classifiers that route certain requests away from Fable to Opus 4.8. The KB pattern is:

```text
request
  ↓
classify risk + workload type
  ↓
choose model + tools + permission mode
  ↓
execute with audit trail
  ↓
verify
  ↓
escalate or fallback if blocked
```

For DeepSeek-backed Claude Code, the fallback model may be another DeepSeek mode, a different provider, or human review.

## What not to copy

Do not copy unsafe or provider-specific behavior blindly:

- Do not attempt to bypass model safeguards.
- Do not request or automate offensive cyber workflows.
- Do not remove biology/chemistry guardrails for unrestricted users.
- Do not rely on Fable/Mythos availability unless current account-level access is confirmed.
- Do not store sensitive prompts or customer code outside approved retention rules.

## Practical design target

Build a DeepSeek V4 Claude Code stack that behaves like a disciplined senior engineering agent:

- it reads the repo before acting;
- writes narrow diffs;
- routes subtasks to scoped subagents;
- keeps durable notes;
- validates every change;
- refuses or escalates unsafe work;
- leaves a reviewable proof trail.

That is the useful part of the Fable/Mythos model story for this project.
