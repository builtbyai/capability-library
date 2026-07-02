# claude-code-via-deepseek

**Composes:** deepseek-router
**Trigger:** setup-only
**Summary:** Adds claude-deepseek CLI to PATH; exports ANTHROPIC_BASE_URL

This is a wiring recipe. It contains no domain logic — it subscribes to events and dispatches jobs that already exist in the composed capabilities.

## Wiring sketch

```ts
import { bus, jobs } from '@multimarcdown/core';
// subscribe to trigger event and dispatch the next handler in the chain.
```

See [packages/workflows/README.md](../README.md) for the workflow contract.
