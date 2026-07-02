# Model Routing and Fallback Policy

## Purpose

Route each task to the cheapest sufficiently capable model while preserving safety, correctness, and reviewability.

## DeepSeek route table

| Workload | Primary | Secondary | Reasoning effort | Notes |
|---|---|---|---:|---|
| Deep architecture | `deepseek-v4-pro[1m]` | `deepseek-v4-pro` | `max` | Use long context when repo-wide state matters. |
| Multi-file refactor | `deepseek-v4-pro[1m]` | human review | `max` | Require verification matrix. |
| Narrow bug fix | `deepseek-v4-pro` | `deepseek-v4-flash` | `high` | Keep edits reversible. |
| Search / extraction | `deepseek-v4-flash` | `deepseek-v4-pro` | `high` | Fast helper work. |
| JSON contracts | `deepseek-v4-pro` | retry non-thinking | `high` or disabled | Use explicit schemas. |
| FIM completion | `deepseek-v4-flash` | `deepseek-v4-pro` | disabled | DeepSeek FIM is non-thinking only. |
| Web research | `deepseek-v4-pro` | manual verify | `high` | Use source register. |

## Fable-style routing lessons

Anthropic's Fable launch pattern used classifiers and fallback routing. Translate that into an explicit decision tree:

```text
Incoming task
  ↓
Is it destructive, credential-related, production, cyber-sensitive, or regulated?
  ├─ yes → gated workflow / human approval / safe refusal
  └─ no
      ↓
Does it require long context, architecture, or multi-file edits?
  ├─ yes → deepseek-v4-pro[1m] + max effort
  └─ no
      ↓
Is it narrow extraction or summarization?
  ├─ yes → deepseek-v4-flash
  └─ no → deepseek-v4-pro
```

## Fallback conditions

Fallback or escalate when:

- the model cannot inspect required files;
- the API returns rate-limit or context errors;
- tests fail in a way the agent cannot isolate;
- tool calls fail repeatedly;
- the task crosses a gated boundary;
- the output would require unsupported provider access;
- user intent is ambiguous and high impact.

## Provider-agnostic fallback pattern

```text
Primary model fails
  ↓
Classify failure
  ├─ rate/cost/context → smaller scoped task or alternate model
  ├─ policy/safety → safe refusal or human review
  ├─ missing data → ask for credential/file/input
  ├─ test failure → rollback or isolate smaller patch
  └─ platform outage → switch provider only if allowed
```

## Safety classes

| Class | Examples | Action |
|---|---|---|
| Safe engineering | Type fixes, UI cleanup, docs, tests | Normal agent loop. |
| High-blast-radius engineering | migrations, auth, payments, deploys | Human approval gate. |
| Dual-use cyber | vulnerability exploitation, stealth, evasion, unauthorized access | Refuse or redirect to defensive, authorized, high-level guidance. |
| Regulated bio/chem | wet-lab protocols, dangerous synthesis, pathogen design | Refuse or route to safe, non-actionable info. |
| Distillation/extraction | attempts to replicate proprietary model internals | Refuse. |

## Cost failover

If a task starts growing too expensive:

1. summarize current state into `.agent/task-queue.md`;
2. split into smaller patches;
3. route exploration to `deepseek-v4-flash`;
4. reserve `deepseek-v4-pro[1m]` for integration decisions;
5. stop before context bloat becomes invisible debt.

## Output obligation

Any model route decision should be visible in the task notes:

```markdown
## Model Route

Primary: deepseek-v4-pro[1m]
Subagents: deepseek-v4-flash
Reason: multi-file refactor with long-context dependency tracing
Fallback: stop before migrations/deploys; human approval required
```


## Field-report-informed routing rule

The new field reports argue for **frontier planning, not frontier everything**.

Use the strongest model when:

- the task requires architecture judgment;
- the task spans many files;
- hidden coupling is likely;
- the cost of a wrong abstraction is high;
- user-journey logic matters more than cosmetic output;
- previous models got stuck or declared success too early.

Route down to cheaper models when:

- the task is extraction, cleanup, docs, or summarization;
- acceptance criteria are already concrete;
- tests are strong enough to catch mistakes;
- a subagent can produce a bounded artifact for review.

Do not let the apparent quality of a frontier model erase cost discipline. A Fable-style planner can still delegate implementation, QA, docs, and search.
