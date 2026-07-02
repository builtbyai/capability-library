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

## Templates to copy first

- `templates/.env.deepseek.example`
- `templates/CLAUDE.md`
- `templates/settings.local.json`
- `templates/.mcp.json`
- `templates/agents/*.md`
- `templates/skills/*/SKILL.md`

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

Do not treat model switching as the architecture. Treat it as one dependency in a controlled agent runtime.
