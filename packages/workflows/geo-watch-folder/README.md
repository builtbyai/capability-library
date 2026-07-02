# geo-watch-folder

**Composes:** scheduler,geo-visualization
**Trigger:** scheduler tick
**Summary:** KML URL polled per layer; emits geo.kml.watch.refreshed

This is a wiring recipe. It contains no domain logic — it subscribes to events and dispatches jobs that already exist in the composed capabilities.

## Wiring sketch

```ts
import { bus, jobs } from '@multimarcdown/core';
// subscribe to trigger event and dispatch the next handler in the chain.
```

See [packages/workflows/README.md](../README.md) for the workflow contract.
