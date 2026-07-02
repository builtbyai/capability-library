# DeepSeek V4 Preview × Claude Code Agent Knowledge Base

A repo-style, multi-Markdown knowledge base for connecting **DeepSeek V4 Preview** to **Claude Code** and operating it as an agentic engineering stack.

This package is designed to be dropped into a project root, copied into an internal docs repo, or used as the basis for a CLI-agent bootstrap.

## What this covers

- DeepSeek V4 Preview model selection and API surfaces
- Claude Code configuration using DeepSeek's Anthropic-compatible endpoint
- Agent capability mapping: subagents, skills, hooks, MCP, memory, permissions, and tool routing
- Thinking mode and reasoning-effort rules
- Tool-call protocol, strict schema guardrails, and multi-turn state handling
- URL extraction as a first-class agent skill and MCP-style utility
- Runbooks for setup, testing, cost control, rate limits, and failures
- Copy-paste templates for `.env`, `CLAUDE.md`, `.mcp.json`, agents, skills, and smoke tests

## Fast start

```bash
cp templates/.env.deepseek.example .env.deepseek
# edit .env.deepseek and add your DeepSeek API key
source .env.deepseek

npm install -g @anthropic-ai/claude-code
claude --version
claude
```

For Windows PowerShell:

```powershell
Copy-Item templates/.env.deepseek.example .env.deepseek
# edit .env.deepseek
.\scripts\use-deepseek-claude-code.ps1
claude
```

## Recommended model routing

| Workload | Model | Reasoning | Notes |
|---|---:|---:|---|
| Deep refactors, architecture plans, multi-file migrations | `deepseek-v4-pro[1m]` | `max` | Best default for serious Claude Code work. |
| Fast file edits, lint triage, extraction, summarization | `deepseek-v4-flash` | `high` | Best for subagents and background helpers. |
| JSON/contract generation | `deepseek-v4-pro` | `high` or disabled | Use JSON mode and explicit schema. |
| FIM/code-completion style tasks | `deepseek-v4-flash` or `deepseek-v4-pro` | disabled | FIM is non-thinking only. |

## File map

```text
README.md
sources.md
docs/
  00-index.md
  01-deepseek-v4-preview.md
  02-api-quickstart.md
  03-claude-code-connection.md
  04-agent-capability-map.md
  05-thinking-mode-and-tools.md
  06-url-extractor-agent.md
  07-cost-rate-limit-and-errors.md
  08-security-and-governance.md
runbooks/
  setup.md
  smoke-test.md
  troubleshooting.md
templates/
  .env.deepseek.example
  CLAUDE.md
  settings.local.json
  .mcp.json
  agents/
    architect.md
    refactor-engineer.md
    qa-verifier.md
    url-extractor.md
    docs-cartographer.md
  skills/
    url-extractor/SKILL.md
    deepseek-v4-task/SKILL.md
scripts/
  use-deepseek-claude-code.sh
  use-deepseek-claude-code.ps1
  deepseek_smoke_test.py
  deepseek_agent_loop.py
  url_extractor.py
```
