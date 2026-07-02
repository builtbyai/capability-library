# API Quickstart

## Environment

```bash
export DEEPSEEK_API_KEY="sk-..."
export DEEPSEEK_OPENAI_BASE_URL="https://api.deepseek.com"
export DEEPSEEK_ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
```

## OpenAI-compatible chat completion

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [
      {"role": "system", "content": "You are a senior software architecture assistant."},
      {"role": "user", "content": "Design a staged refactor plan for a messy CRM module."}
    ],
    "thinking": {"type": "enabled"},
    "reasoning_effort": "high"
  }'
```

## Python smoke test

Use `scripts/deepseek_smoke_test.py`.

```bash
python -m venv .venv
source .venv/bin/activate
pip install openai
python scripts/deepseek_smoke_test.py
```

## Provider boundary

Keep application code behind a tiny interface:

```python
from typing import Protocol

class LLMClient(Protocol):
    def complete(self, messages: list[dict], *, model: str) -> str:
        ...
```

Then implement `DeepSeekOpenAIClient` and `DeepSeekAnthropicClient` separately. That makes fallback, testing, and prompt regression easier.

## JSON output

When JSON mode is used:

1. Set the response format.
2. Explicitly tell the model to return JSON.
3. Provide a sample schema.
4. Set an output token limit.
5. Validate the response before use.

Never assume model-generated JSON is valid just because JSON mode was requested.

## Tool-call invariant

Tool calls are declarations, not execution. Your runtime must:

1. Receive the tool call.
2. Validate the function name and arguments.
3. Execute the tool locally or through MCP.
4. Return the tool result to the model.
5. Continue the conversation with full state.
