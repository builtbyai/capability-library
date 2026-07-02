# Agent Capability Map

## Target operating model

The target is a Fable-style engineering agent shell: long-horizon task execution, deep repo context, tool-mediated action, staged verification, and human-auditable checkpoints.

In Claude Code, this is composed from native surfaces:

```text
CLAUDE.md         → project constitution
Subagents         → specialized workers
Skills            → reusable procedural capabilities
MCP               → external tools and data sources
Hooks             → lifecycle enforcement
Settings          → permissions and routing
Scripts           → deterministic verification commands
Runbooks          → operator recovery paths
```

## Capability matrix

| Capability | Claude Code surface | DeepSeek role | Repo artifact |
|---|---|---|---|
| Repo understanding | Read/Grep/Glob + CLAUDE.md | Long-context reasoning | `CLAUDE.md` |
| Architecture planning | Main agent/subagent | Pro/max thinking | `templates/agents/architect.md` |
| Refactor execution | Subagent + Edit/Write/Bash | Pro or Flash depending risk | `templates/agents/refactor-engineer.md` |
| QA verification | Hooks + Bash + subagent | Flash/pro review | `templates/agents/qa-verifier.md` |
| URL extraction | Skill + script + optional MCP | Flash extraction | `templates/skills/url-extractor` |
| Docs generation | Skill + docs subagent | Pro synthesis | `templates/agents/docs-cartographer.md` |
| External data access | MCP server | Tool call reasoning | `templates/.mcp.json` |
| Safety rails | hooks + permissions | N/A | `.claude/settings*.json` |

## Suggested agents

- `architect`: maps boundaries, dependency graph, migration plan.
- `refactor-engineer`: applies narrow edits with tests.
- `qa-verifier`: runs deterministic validation and reports regressions.
- `url-extractor`: extracts, canonicalizes, dedupes, and classifies URLs.
- `docs-cartographer`: turns messy notes into stable Markdown/system docs.

## Agent design contract

Every agent prompt should include:

1. Mission
2. Non-goals
3. Allowed tools
4. Output contract
5. Verification command
6. Escalation conditions

## Agent loop

```text
1. Intake task
2. Read relevant project docs
3. Build execution plan
4. Select subagents
5. Run narrow changes
6. Run verification
7. Emit diff summary
8. Stop at explicit checkpoint
```

Long-horizon agents fail when they cannot tell what "done" means. Every task needs a stop condition.
