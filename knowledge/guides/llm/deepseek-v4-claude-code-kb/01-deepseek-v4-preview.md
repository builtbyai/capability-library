# DeepSeek V4 Preview

## Model family

DeepSeek V4 Preview currently exposes two primary API model names:

- `deepseek-v4-pro`
- `deepseek-v4-flash`

Use model names explicitly. Avoid relying on legacy aliases unless you are intentionally testing migration compatibility.

## Practical model policy

| Decision | Recommended default |
|---|---|
| Highest-quality coding/architecture model | `deepseek-v4-pro[1m]` in Claude Code |
| Lower-latency subagent/default helper | `deepseek-v4-flash` |
| Heavy thinking/refactor mode | `deepseek-v4-pro`, thinking enabled, effort `max` |
| Fast extraction/classification | `deepseek-v4-flash`, thinking disabled or high |
| Long repo context | Use `[1m]` where supported by the integration |

## API compatibility

DeepSeek provides both:

- OpenAI-compatible Chat Completions endpoint
- Anthropic-compatible Messages endpoint

That means you can integrate it in two distinct ways:

1. Direct app/API code using OpenAI-compatible SDKs.
2. Claude Code / Anthropic-style agents using `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`.

## Architectural implication

A clean implementation should isolate DeepSeek behind a provider boundary:

```text
Application / CLI / Agent Runtime
        ↓
LLM Provider Interface
        ↓
DeepSeek OpenAI Adapter OR DeepSeek Anthropic Adapter
        ↓
DeepSeek API
```

This avoids hard-coding model-provider behavior into your repo automation.

## Legacy model caution

Do not build new systems around `deepseek-chat` or `deepseek-reasoner`. Treat them as migration aliases only.
