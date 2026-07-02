# connector-health-rollup

**Composes:** scheduler,connector-config
**Trigger:** scheduler tick (hourly)
**Summary:** Re-tests every connector; emits connector.health.changed

This is a wiring recipe. It contains no domain logic — it subscribes to events and dispatches jobs that already exist in the composed capabilities.

## Wiring sketch

```ts
import { bus, jobs } from '@multimarcdown/core';
// subscribe to trigger event and dispatch the next handler in the chain.
```

See [packages/workflows/README.md](../README.md) for the workflow contract.
