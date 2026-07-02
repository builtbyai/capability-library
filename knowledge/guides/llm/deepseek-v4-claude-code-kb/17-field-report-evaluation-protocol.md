# Field-Report Evaluation Protocol

## Why this exists

The Fable field reports are useful, but they are not controlled experiments. This protocol turns impressive anecdotes into repeatable eval fixtures for DeepSeek V4, Claude Code, Codex, Opus, local models, or any future agent runtime.

## Core rule

Do not compare models by vibe. Compare **runs** under the same task, repo state, tool permissions, budget, and verification commands.

## Minimum eval design

Each evaluation must define:

```yaml
task_id: <id>
repo_commit: <sha>
models:
  - deepseek-v4-pro[1m]
  - deepseek-v4-pro
  - deepseek-v4-flash
  - competitor-or-baseline
agent_harness: claude-code
max_wall_time_minutes: <n>
max_model_cost_usd: <n>
max_tool_rounds: <n>
allowed_tools:
  - read
  - grep
  - edit
  - bash-test
forbidden_tools:
  - production-deploy
  - external-write
  - secrets
verification_commands:
  - <command>
acceptance_criteria:
  - <criterion>
```

## Repeat count

Run every model at least three times on the same fixture when cost allows. Single-run results can be logged as a field report, but they should not drive routing policy alone.

## Scorecard

| Dimension | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| Correctness | fails | partial | tests pass with gaps | acceptance met | acceptance met + edge cases |
| Architecture | harmful | messy | tolerable | clean | improves boundaries |
| Autonomy | stuck | many interventions | some interventions | mostly autonomous | autonomous with good checkpoints |
| Verification | none | weak | basic tests | targeted tests | tests + evidence trail |
| Cost discipline | runaway | high unplanned | acceptable | efficient | cheapest sufficient route |
| Overreach | unrelated edits | several extras | minor extras | scoped | scoped + explicitly reviewed |
| Handoff quality | vague | partial | usable | complete | complete + rollback |

A production-acceptable run requires:

- correctness >= 3;
- architecture >= 3;
- verification >= 3;
- overreach >= 3;
- no forbidden tool use;
- no unapproved high-blast-radius change.

## Specific eval fixtures inspired by field reports

### Fixture A — complex generated app

Goal: build a multi-form financial-planning app from a dense spec.

Measures:

- number of forms completed;
- simulation math correctness;
- component architecture;
- validation coverage;
- generated tests;
- whether the agent stops early or completes the whole surface.

### Fixture B — product clone UI

Goal: build a Linear/Notion-style interface from a product description.

Measures:

- layout fidelity;
- state model correctness;
- keyboard/navigation behavior;
- empty/error/loading states;
- accessibility basics;
- whether the agent invents unrelated visual changes.

### Fixture C — language port / migration

Goal: port a bounded module from language A to language B.

Measures:

- test pass rate;
- semantic parity;
- module coverage;
- generated fixtures;
- compatibility with idioms of target language;
- whether the agent declares victory too early.

### Fixture D — live bug diagnosis

Goal: fix a non-obvious runtime bug.

Measures:

- reproducibility;
- runtime evidence gathered;
- root-cause quality;
- patch minimality;
- regression tests;
- number of failed theory loops.

### Fixture E — UI flow logic

Goal: fix a user journey where the wrong thing appears at the wrong time.

Measures:

- journey invariants;
- E2E assertions;
- role-based visibility;
- empty-state correctness;
- screenshot and DOM evidence.

## Run log template

```markdown
# Agent Eval Run Log

Task:
Model:
Harness:
Date:
Repo commit:
Budget:

## Plan Summary

## Subagents Used

| Agent | Model | Purpose | Result |
|---|---|---|---|

## Files Changed

## Verification Commands

| Command | Result | Notes |
|---|---|---|

## Defects Found By Reviewer

| Severity | Finding | Resolution |
|---|---|---|

## Cost / Token Notes

## Overreach Review

## Final Score

## Lessons
```

## Interpretation rules

- A high pass rate does not prove maintainability.
- A beautiful UI does not prove logic correctness.
- A long autonomous run does not prove good autonomy if it lacks checkpoints.
- A cheaper run is not better if it creates review debt.
- A frontier model is not the right default if a smaller model satisfies the acceptance contract.

## Routing decision after eval

Only promote a model or workflow after it wins under repeated fixtures.

```text
If Fable-style harness + DeepSeek V4 Pro wins architecture but loses cost:
  keep it for planning/refactors only.

If DeepSeek V4 Flash passes extraction/docs/search fixtures:
  route helper agents to Flash.

If a local model passes repetitive implementation fixtures:
  use it for overnight worker tasks after planner creates specs.

If any model overreaches:
  tighten CLAUDE.md, permissions, and overreach review.
```
