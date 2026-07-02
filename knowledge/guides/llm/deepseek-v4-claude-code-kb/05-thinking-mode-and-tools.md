# Thinking Mode and Tools

## Thinking mode

DeepSeek V4 supports thinking mode and effort control.

Recommended policy:

| Task | Thinking | Effort |
|---|---:|---:|
| Simple extraction | disabled or enabled | high |
| Multi-file bug diagnosis | enabled | high |
| Complex repo refactor | enabled | max |
| Claude Code autonomous task | enabled | max |
| JSON-only formatting | disabled or high | high |

## Parameter examples

OpenAI-compatible:

```json
{
  "model": "deepseek-v4-pro",
  "messages": [{"role": "user", "content": "Plan the refactor."}],
  "thinking": {"type": "enabled"},
  "reasoning_effort": "max"
}
```

Anthropic-compatible:

```json
{
  "model": "deepseek-v4-pro",
  "messages": [{"role": "user", "content": "Plan the refactor."}],
  "thinking": {"type": "enabled"},
  "output_config": {"effort": "max"}
}
```

## Tool-call loop

Pseudo-flow:

```text
request → model emits tool_call → runtime validates args → runtime executes tool → runtime sends tool result → model continues
```

## Critical multi-turn rule

When thinking mode and tool calls are used together, preserve the assistant message fields required by the provider. In particular, do not flatten away reasoning/tool-call state between turns.

A safe persistence shape:

```json
{
  "role": "assistant",
  "content": "...",
  "reasoning_content": "...",
  "tool_calls": [
    {
      "id": "call_...",
      "type": "function",
      "function": {
        "name": "extract_urls",
        "arguments": "{\"text\": \"...\"}"
      }
    }
  ]
}
```

## Tool schemas

Use strict schemas where possible.

Minimum function tool schema:

```json
{
  "type": "function",
  "function": {
    "name": "extract_urls",
    "description": "Extract canonical URLs from arbitrary text.",
    "parameters": {
      "type": "object",
      "properties": {
        "text": {"type": "string"},
        "dedupe": {"type": "boolean"},
        "include_mailto": {"type": "boolean"}
      },
      "required": ["text"],
      "additionalProperties": false
    },
    "strict": true
  }
}
```

## Failure prevention

- Validate every tool argument.
- Reject unknown tool names.
- Limit file-system tools by scope.
- Return structured tool errors instead of crashing the loop.
- Log tool calls separately from model text.
