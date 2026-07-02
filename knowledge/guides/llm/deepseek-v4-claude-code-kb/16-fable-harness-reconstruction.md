# Reconstructing Fable-Like Behavior with DeepSeek V4 and Claude Code

## Scope

This document converts the field reports into an implementable agent harness. It does **not** claim that DeepSeek V4 Preview is equivalent to Fable 5. It defines a practical operating system that can reproduce many observable behaviors users attributed to Fable:

- longer autonomous runs;
- better decomposition;
- stronger verification habits;
- less short-sighted patching;
- subagent fan-out;
- visible memory;
- explicit cost and risk governance.

## Reference architecture

```text
User request
  ↓
Mission compiler
  ↓
Risk + cost router
  ↓
Principal planner: deepseek-v4-pro[1m]
  ↓
Task graph: .agent/task-queue.md
  ↓
Subagents
  ├─ scout: deepseek-v4-flash
  ├─ implementer: deepseek-v4-pro
  ├─ verifier: deepseek-v4-flash
  ├─ docs cartographer: deepseek-v4-flash
  └─ adversarial reviewer: deepseek-v4-pro
  ↓
Verification matrix
  ↓
Human approval gates
  ↓
Final handoff
```

## Ten mechanisms to implement

### 1. Mission file before work

Every long-horizon run starts with `.agent/mission.md`:

```markdown
# Mission

## User objective

## Non-goals

## Acceptance criteria

## Forbidden actions

## Budget
- Max wall time:
- Max model spend:
- Max changed files before checkpoint:

## Stop conditions
```

Do not let the agent start editing before the mission file exists for large tasks.

### 2. Plan file before implementation

The Jonathan Fulton report is notable because both agents were asked to write a plan before executing. Preserve that pattern:

```text
plan first → inspect against repo → partition → execute → verify
```

The plan must include:

- subsystem map;
- task graph;
- expected files/directories;
- verification strategy;
- merge order;
- rollback path.

### 3. Parallel subagent fan-out

Use subagents when work units are independent. Do not use fan-out when the modules are tightly coupled or the repo has no tests.

Good fan-out candidates:

- form pages with shared schema;
- independent parser dialects;
- documentation sections;
- UI route shells;
- test fixture conversion;
- source extraction and classification.

Bad fan-out candidates:

- database migrations;
- auth flows;
- payments;
- state machine rewrites;
- shared domain abstractions that need one owner.

### 4. Evidence-before-theory loop

For bugs, the agent must stop theorizing and collect evidence:

```text
symptom
  ↓
reproduce
  ↓
logs / stack trace / failing test / screenshot / network trace
  ↓
minimal root cause
  ↓
patch
  ↓
rerun same evidence path
```

This mirrors the field reports where users valued the model for using real runtime data instead of staying in speculation.

### 5. Pause/resume tool protocol

Inspired by the Datasette Agent work described in the Simon Willison report, every tool loop should be designed to pause safely.

Required tool-call metadata:

```json
{
  "tool_call_id": "tc_<stable-id>",
  "tool_name": "<name>",
  "status": "pending|running|paused|completed|failed",
  "requires_human": false,
  "side_effect_level": "read|repo-write|external-write|destructive",
  "resume_payload": {}
}
```

Pause conditions:

- secret access needed;
- production write needed;
- destructive command proposed;
- tool result contradicts the plan;
- cost budget reached;
- subagent disagreement on architecture.

### 6. User-journey invariants for UI work

The field reports repeatedly distinguish screenshot capture from actual flow reasoning. For UI tasks, require journey invariants:

```markdown
## User Journey Invariants

- Given <state>, the user should see <screen/component>.
- Given <empty state>, the app should not open <irrelevant UI>.
- Given <role>, the user should not see <unauthorized action>.
- Given <completed step>, the next CTA should be <action>.
```

Then verify with Playwright, screenshots, DOM assertions, or a manual checklist.

### 7. Overreach detector

Fable-like agents can be proactive. That is useful until it mutates unrelated assets.

After each patch, run an overreach review:

```text
Did any changed file fall outside the acceptance criteria?
Did the agent rename a concept without permission?
Did it replace an architecture term with a weaker abstraction?
Did it “improve” UI/copy/sprites/assets unrelated to the ticket?
```

If yes, revert or isolate the unrelated change.

### 8. Context budget and compaction discipline

Long context is a budget, not an excuse to hoard state.

Rules:

- keep durable facts in `.agent/*.md`;
- summarize completed branches out of active context;
- re-read only authoritative files, not stale summaries;
- checkpoint at 25%, 50%, and 75% of configured context;
- do not let compaction hide unresolved risks.

### 9. Reviewer model loop

For serious changes, use a second pass:

```text
implementer produces patch
  ↓
adversarial reviewer checks architecture, tests, security, overreach
  ↓
implementer fixes bounded issues
  ↓
qa-verifier runs commands
  ↓
human gets final proof trail
```

The reviewer must not rewrite the feature. It only produces findings with file references and severity.

### 10. Cost governance

Fable-style long runs can be expensive. DeepSeek may be cheaper, but the pattern still needs budgets.

Set explicit budgets in `.agent/mission.md`:

```yaml
budget:
  max_model_cost_usd: 25
  max_tool_rounds: 60
  max_changed_files_before_checkpoint: 15
  max_failed_test_iterations: 3
  checkpoint_interval_minutes: 20
```

If the budget is hit, summarize, stop, and request a route decision.

## Copy-paste Claude Code mission prompt

```markdown
You are running a Fable-style long-horizon engineering sprint using DeepSeek V4 through Claude Code.

Before editing, create or update `.agent/mission.md`, `.agent/acceptance.md`, `.agent/task-queue.md`, `.agent/verification.md`, and `.agent/risks.md`.

Use this loop:
Frame → Inspect → Plan → Partition → Patch → Verify → Review → Handoff.

Use subagents only for independent work. Use cheaper/fast subagents for search, extraction, docs, and QA. Keep architecture decisions in the main session.

Do not perform production deploys, migrations, credential changes, payment/auth changes, destructive operations, or external writes without explicit approval.

For UI work, verify user-journey invariants, not just screenshots.

For bugs, collect runtime evidence before theorizing.

If stuck for more than three failed iterations, stop and write a risk note instead of silently grinding.

Final output must include summary, files changed, verification, risks, overreach review, model route, and next actions.
```

## Implementation target

The goal is a harness where even a non-Fable model behaves more like a senior autonomous engineering system because the runtime enforces:

- explicit intent;
- scoped autonomy;
- measurable correctness;
- bounded spend;
- reversible changes;
- transparent uncertainty.
