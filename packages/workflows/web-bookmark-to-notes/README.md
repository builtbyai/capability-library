# web-bookmark-to-notes

**Composes:** web-clipper,intake-pipeline,document-ingestion,knowledge-index
**Trigger:** POST /api/workflow/web-bookmark-to-notes
**Summary:** URL clipped to markdown -> intake -> chunks -> RAG

This is a wiring recipe. It contains no domain logic — it subscribes to events and dispatches jobs that already exist in the composed capabilities.

## Wiring sketch

```ts
import { bus, jobs } from '@multimarcdown/core';
// subscribe to trigger event and dispatch the next handler in the chain.
```

See [packages/workflows/README.md](../README.md) for the workflow contract.
