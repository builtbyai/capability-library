# Agent Operating System Blueprint

## Definition

An agent operating system is the layer between the model and the codebase. It turns model capability into deterministic execution.

For this KB, the agent OS is composed of:

```text
CLAUDE.md
settings.local.json
.mcp.json
.agent/*.md
subagents
skills
hooks
scripts
runbooks
evaluation fixtures
```

## Directory skeleton

```text
project-root/
  CLAUDE.md
  .mcp.json
  .claude/
    settings.local.json
    agents/
      architect.md
      refactor-engineer.md
      qa-verifier.md
      docs-cartographer.md
      safety-router.md
    skills/
      long-horizon-agent/SKILL.md
      model-router/SKILL.md
      url-extractor/SKILL.md
    hooks/
      command-policy.json
      completion-contract.json
  .agent/
    mission.md
    acceptance.md
    decisions.md
    codebase-map.md
    task-queue.md
    verification.md
    risks.md
```

## State files

### `.agent/mission.md`

Captures the active mission, scope, and non-goals.

```markdown
# Mission

## Objective

## Non-goals

## Constraints

## Current branch

## Human owner
```

### `.agent/acceptance.md`

Defines done in verifiable terms.

```markdown
# Acceptance Criteria

- [ ] User-visible behavior
- [ ] API contract
- [ ] Data migration / no migration
- [ ] Permissions
- [ ] Test command
- [ ] Rollback condition
```

### `.agent/decisions.md`

Prevents repeated debate and context drift.

```markdown
# Decision Log

## YYYY-MM-DD — Decision title

Decision:
Reason:
Alternatives rejected:
Impact:
```

### `.agent/codebase-map.md`

Maintains subsystem boundaries.

```markdown
# Codebase Map

## Domains

## Entry points

## Persistence

## External APIs

## Background jobs

## Auth boundaries

## Risk zones
```

### `.agent/verification.md`

Maps changes to proof.

```markdown
# Verification Matrix

| Change type | Command | Expected result | Owner |
|---|---|---|---|
| TypeScript edit | npm run typecheck | pass | qa-verifier |
| UI edit | npm run test:ui | pass | qa-verifier |
| Worker edit | npm run test:worker | pass | qa-verifier |
```

## Skill contracts

A skill is a repeatable work pattern. It should contain:

- when to use it
- inputs
- forbidden actions
- process
- output format
- verification

## Subagent contracts

A subagent should be narrow enough that its output can be reviewed:

```markdown
---
name: qa-verifier
description: Reviews diffs, identifies regressions, and proposes verification commands.
tools: Read, Grep, Glob, Bash
---

You verify. You do not rewrite architecture.
```

## Operating modes

| Mode | Use | Autonomy | Verification |
|---|---|---:|---|
| Inspect | Codebase discovery | read-only | notes only |
| Patch | Narrow bug fix | medium | targeted tests |
| Refactor | Boundary-preserving cleanup | medium/high | full relevant suite |
| Migration | Data/schema changes | gated | dry run + rollback |
| Release | Production deploy | gated | human approval |

## Completion contract

Every agent run ends with this visible handoff:

```markdown
## Summary

## Files Changed

## Verification

## Risks / Follow-ups

## Next Suggested Task
```

## Why this matters

Frontier model capability without an operating system causes drift. The same model inside a tight operating system produces reliable, reviewable, compounding engineering work.
