# Cost, Rate Limit, and Errors

## Cost control

Cost is driven by:

- input tokens
- output tokens
- reasoning tokens
- cache hit vs cache miss behavior
- model choice
- number of subagents
- repeated repo scans

## Cost policy

| Rule | Why |
|---|---|
| Use `deepseek-v4-flash` for extract/classify/doc cleanup | Avoid burning Pro on simple work. |
| Use `deepseek-v4-pro` for architecture and risky refactors | Avoid cheap mistakes on high-context tasks. |
| Keep stable repo instructions at the front of prompts | Increases cache-hit likelihood. |
| Avoid redundant full-repo dumps | Burns context and money. |
| Stop at checkpoints | Prevents runaway autonomous loops. |

## Concurrency

Concurrency limits are account-level. A request is counted as active while it is still processing. Treat long Claude Code sessions and subagents as concurrent work.

## Common errors

| Status | Meaning | Operator response |
|---:|---|---|
| 400 | Bad request format | Validate JSON and required fields. |
| 401 | Authentication failed | Check API key/env var. |
| 402 | Insufficient balance | Check billing/balance. |
| 422 | Invalid parameters | Check model name, thinking/tool fields, schema. |
| 429 | Rate/concurrency limit | Queue/retry with backoff. |
| 500 | Server error | Retry with jitter; preserve request ID/logs. |
| 503 | Service overloaded | Backoff, reduce concurrency, retry later. |

## Preflight script

Use:

```bash
python scripts/deepseek_smoke_test.py
```

## Runaway-agent guardrails

- cap max turns
- require checkpoint before broad writes
- prefer narrow tool permissions
- log every mutating command
- use hooks for test/lint gates
- do not allow unconstrained shell execution for unknown repos
