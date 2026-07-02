# Runbook — Troubleshooting

## Claude Code still uses Anthropic instead of DeepSeek

Check:

```bash
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_MODEL
```

Expected:

```text
https://api.deepseek.com/anthropic
deepseek-v4-pro[1m]
```

## Authentication fails

Check:

```bash
echo ${ANTHROPIC_AUTH_TOKEN:0:8}
echo ${DEEPSEEK_API_KEY:0:8}
```

Do not print full keys.

## 422 invalid parameter

Likely causes:

- unsupported model alias
- invalid thinking field
- invalid tool schema
- strict schema missing required fields
- unsupported Anthropic compatibility feature

## Thinking/tool multi-turn failure

If a later turn fails after a tool call, verify your runtime preserved assistant state, including tool calls and provider-required reasoning fields.

## Subagents feel weak

Set:

```bash
export CLAUDE_CODE_SUBAGENT_MODEL="deepseek-v4-flash"
export CLAUDE_CODE_EFFORT_LEVEL="max"
```

For high-risk subagents, explicitly set their model to `deepseek-v4-pro[1m]` in the agent definition.
