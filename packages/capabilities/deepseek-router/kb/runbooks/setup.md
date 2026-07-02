# Runbook — Setup DeepSeek V4 in Claude Code

## Prerequisites

- Node.js 18+
- Claude Code CLI
- DeepSeek API key
- Git installed and available on PATH

## Steps

```bash
npm install -g @anthropic-ai/claude-code
cp templates/.env.deepseek.example .env.deepseek
# edit .env.deepseek
source .env.deepseek
claude --version
claude
```

## First prompt

```text
Read CLAUDE.md and docs/00-index.md. Confirm the operating model. Do not edit files yet.
```

## Success criteria

- Claude Code launches.
- Model calls route through DeepSeek endpoint.
- Main model is `deepseek-v4-pro[1m]`.
- Subagent model is `deepseek-v4-flash`.
- A read-only prompt succeeds before any edit prompt.
