# Fable-Style Agent Architecture on DeepSeek

## Goal

Use DeepSeek V4 Preview behind Claude Code to approximate the useful operating pattern described in the Fable/Mythos materials: long-context, long-horizon, tool-using, memory-backed engineering work.

This is not a claim that DeepSeek V4 equals Claude Fable/Mythos internally. It is a practical architecture for getting the same class of workflow shape.

## Runtime topology

```text
Developer
  ↓
Claude Code CLI
  ↓
Project CLAUDE.md + settings + permissions
  ↓
DeepSeek Anthropic-compatible API
  ↓
DeepSeek V4 Pro / Flash
  ↓
Tools: Read, Edit, Bash, Grep, Glob, WebSearch, WebFetch, MCP
  ↓
Repo files + .agent memory + verification scripts
```

## Model roles

| Role | DeepSeek model | Reasoning effort | Claude Code surface | Purpose |
|---|---|---:|---|---|
| Principal planner | `deepseek-v4-pro[1m]` | `max` | main session | Architecture, migrations, high-risk refactors. |
| Implementation worker | `deepseek-v4-pro` | `high` | subagent or main | Multi-file edits and code synthesis. |
| Fast scout | `deepseek-v4-flash` | `high` | subagent | Search, summarization, triage, extraction. |
| Contract writer | `deepseek-v4-pro` | `high` | skill / subagent | API schemas, docs, migrations, invariants. |
| QA verifier | `deepseek-v4-flash` | `high` | subagent | Test plan, diff review, regression watch. |

## Agent control loop

Use this loop for every serious task:

```text
1. Frame
   - Convert request into acceptance criteria.
   - Identify forbidden/destructive actions.

2. Inspect
   - Read only the files needed.
   - Build a temporary code map.

3. Plan
   - Partition into narrow work units.
   - Assign subagent roles.

4. Execute
   - Edit in small reversible patches.
   - Keep a running decision log.

5. Verify
   - Run static checks, tests, and targeted smoke checks.
   - Compare output against acceptance criteria.

6. Harden
   - Add docs, guards, migrations, and observability notes.

7. Handoff
   - Summarize changed files, verification, and unresolved risk.
```

## Memory layout

Create this inside any real project that will run long-horizon agent work:

```text
.agent/
  mission.md              # Current project objective and non-goals
  acceptance.md           # Task-level acceptance criteria
  decisions.md            # Architecture decisions and why
  codebase-map.md         # Subsystem map and boundaries
  task-queue.md           # Backlog of agent-sized work units
  verification.md         # Commands and expected results
  risks.md                # Known risk surfaces and rollback paths
  context/
    api-contracts.md
    data-models.md
    auth-boundaries.md
    deployment.md
```

## Permission model

Default to safe autonomy:

| Action | Default | Reason |
|---|---|---|
| Read repo files | Allow | Required for grounded work. |
| Search repo | Allow | Required for dependency tracing. |
| Edit repo files | Allow inside scoped task | Core Claude Code use case. |
| Run tests/lint/build | Allow | Verification requirement. |
| Install dependencies | Ask / gated | Can change supply-chain surface. |
| Run migrations | Ask / gated | Can alter data. |
| Deploy production | Ask / gated | High blast radius. |
| Touch secrets | Ask / gated | Credential risk. |
| External writes | Ask / gated | Side effects outside repo. |

## Subagent partitioning

Use subagents to enforce boundaries, not just to parallelize.

```text
architect
  owns: boundaries, architecture, sequencing

refactor-engineer
  owns: narrow code patches, dependency inversion, type cleanup

qa-verifier
  owns: regression checks, smoke tests, acceptance criteria

docs-cartographer
  owns: docs, diagrams, source-of-truth cleanup

url-extractor
  owns: URL inventory, source registers, citation maps

safety-router
  owns: risk classification and escalation decisions
```

## Hooks

Hooks should turn good behavior into default behavior:

- before tool use: block destructive commands by default
- after edit: require diff summary
- before completion: require verification section
- on failure: append to `.agent/risks.md`
- on long task: update `.agent/task-queue.md`

## MCP use

MCP servers should expose narrow, auditable capabilities:

- docs fetcher
- issue tracker
- local database introspection in read-only mode
- browser automation in sandbox mode
- test runner
- deployment status reader

Avoid broad MCP tools that can mutate production without a policy gate.

## DeepSeek-specific constraints

DeepSeek's thinking mode can use tool calls, but when tool calls are involved the `reasoning_content` must be preserved in subsequent API requests. This matters if you are writing your own loop outside Claude Code.

For Claude Code itself, prefer the official DeepSeek Anthropic-compatible environment-variable route unless you have a reason to build a custom client.

## Production-ready checklist

- [ ] `.env.deepseek` is local-only and ignored by git.
- [ ] `CLAUDE.md` exists in project root.
- [ ] Agent memory files exist under `.agent/`.
- [ ] Dangerous commands are gated by hooks or settings.
- [ ] Main model is `deepseek-v4-pro[1m]`.
- [ ] Subagent model is `deepseek-v4-flash`.
- [ ] Verification commands are documented.
- [ ] Fallback policy exists.
- [ ] Cost/rate-limit policy exists.
- [ ] No generated docs claim Fable/Mythos availability without re-checking current access.
