# Claude Code Connection

## Goal

Run Claude Code while routing model calls through DeepSeek's Anthropic-compatible API.

## Linux/macOS setup

```bash
export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
export ANTHROPIC_AUTH_TOKEN="$DEEPSEEK_API_KEY"
export ANTHROPIC_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro[1m]"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_EFFORT_LEVEL="max"
```

Then:

```bash
claude
```

## Windows PowerShell setup

```powershell
$env:ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
$env:ANTHROPIC_AUTH_TOKEN=$env:DEEPSEEK_API_KEY
$env:ANTHROPIC_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL="deepseek-v4-pro[1m]"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL="deepseek-v4-flash"
$env:CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
$env:CLAUDE_CODE_EFFORT_LEVEL="max"
claude
```

## Project-local settings

Use project settings for repo conventions and local settings for secrets or machine-specific behavior.

Suggested split:

```text
.claude/settings.json          # team-shareable defaults
.claude/settings.local.json    # ignored local overrides
.env.deepseek                  # ignored credentials/env
CLAUDE.md                      # repo operating manual
```

## Claude Code startup checklist

```bash
node --version        # Node 18+
claude --version
source .env.deepseek
claude doctor || true
claude
```

Inside Claude Code, start with:

```text
Read CLAUDE.md. Build a task plan. Do not edit files until the plan is explicit.
```

## Model routing strategy

- Main session: `deepseek-v4-pro[1m]`
- Subagents: `deepseek-v4-flash`
- Deep repair or architecture work: request high/max effort
- Extraction and docs: route to flash unless repo-wide reasoning is needed

## Do not do this

- Do not paste API keys into `CLAUDE.md`.
- Do not let agents run mutating commands without hooks or review gates.
- Do not give every subagent full Bash access by default.
- Do not let generated tool arguments bypass validation.
