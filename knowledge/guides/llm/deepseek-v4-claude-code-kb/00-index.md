# DeepSeek V4 Claude Code KB — Index

Use this KB as a layered system, not as scattered notes.

## Recommended reading order

1. [DeepSeek V4 Preview](01-deepseek-v4-preview.md)
2. [API Quickstart](02-api-quickstart.md)
3. [Claude Code Connection](03-claude-code-connection.md)
4. [Agent Capability Map](04-agent-capability-map.md)
5. [Thinking Mode and Tools](05-thinking-mode-and-tools.md)
6. [URL Extractor Agent](06-url-extractor-agent.md)
7. [Cost, Rate Limit, and Errors](07-cost-rate-limit-and-errors.md)
8. [Security and Governance](08-security-and-governance.md)
9. [Claude Fable / Mythos Research Notes](09-claude-fable-mythos-research.md)
10. [Fable-Style Agent Architecture on DeepSeek](10-fable-style-agent-architecture-on-deepseek.md)
11. [Agent Operating System Blueprint](11-agent-operating-system-blueprint.md)
12. [Model Routing and Fallback Policy](12-model-routing-and-fallback-policy.md)
13. [Evaluation Harness](13-evaluation-harness.md)
14. [Implementation Backlog](14-implementation-backlog.md)
15. [Fable Field Reports](15-fable-field-reports.md)
16. [Fable Harness Reconstruction](16-fable-harness-reconstruction.md)
17. [Field Report Evaluation Protocol](17-field-report-evaluation-protocol.md)

## Templates to copy first

- `templates/.env.deepseek.example`
- `templates/CLAUDE.md`
- `templates/settings.local.json`
- `templates/.mcp.json`
- `templates/agents/*.md`
- `templates/skills/*/SKILL.md`
- `templates/hooks/*.json`

## Execution principle

Claude Code is the orchestration shell. DeepSeek V4 is the reasoning/model backend. Agent capabilities are composed from:

- model routing
- tool permissions
- subagent specialization
- MCP servers
- hooks
- skills
- repeatable verification commands
- project documentation contracts
- persistent memory files
- evaluation fixtures
- safety routing and fallback gates
- field-report ingestion and confidence labeling
- long-run checkpoints and overreach review

Do not treat model switching as the architecture. Treat it as one dependency in a controlled agent runtime.

## Current production stance

- DeepSeek V4 Preview is usable as the Claude Code backend through DeepSeek's Anthropic-compatible API.
- Claude Fable/Mythos should be treated as a design reference for long-horizon agents, not a dependable runtime dependency, because Anthropic posted a June 12, 2026 access-suspension notice after the June 9 launch.
- This KB therefore implements a **Fable-style operating pattern** on top of DeepSeek V4: planner, memory, tools, subagents, permissions, hooks, verification, and safety gates.


## New field-report layer

The newer files `15`, `16`, and `17` should be read after the core DeepSeek/Claude Code setup. They explain how to turn impressive Fable-style reports into concrete harness patterns without overclaiming model internals.
