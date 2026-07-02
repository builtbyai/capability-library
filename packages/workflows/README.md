# packages/workflows/

Composed orchestration recipes built from capabilities. A workflow contains no new domain logic — it wires capability handlers together and runs them through the core job runner. Recipes are bus subscriptions + `jobs.enqueue()` calls; nothing more.

Each workflow is its own workspace package (`@multimarcdown/workflow-<name>`) with `manifest.yaml` + `README.md` + `recipe.ts`.

## Current recipes (13 seeded)

### Ingest cluster
- `pdf-to-rag` — `intake-pipeline → document-ingestion → knowledge-index`
- `web-bookmark-to-notes` — `web-clipper → intake-pipeline → document-ingestion → knowledge-index`
- `folder-watch-import` — chokidar watcher → `intake-pipeline`
- `rooflink-backfill-to-rag` — `bulk-media-import (--emit-intake) → intake → doc/media → knowledge-index`

### AI cluster
- `bulk-rename-folder` — `scheduler → ai-file-renamer` (scan + propose + apply)
- `media-upscale-batch` — `media-processing → replicate-api`
- `claude-code-via-deepseek` — configuration-only (sets up the deepseek-router CLI on PATH)

### Cross-cluster
- `gmail-to-rag` — `email-connector → intake → document-ingestion → knowledge-index`
- `geo-watch-folder` — `scheduler → geo-visualization` (KML URL refresh per layer)
- `terminal-with-scheduled-claude` — `scheduler → local-agent-terminal:runProfile` (keepAlive=true)

### Utility
- `connector-health-rollup` — `scheduler → connector-config` (hourly retest)
- `document-places-to-map` — `document-ingestion → geo-visualization` (extracted addresses → layer)
- `rag-reindex-on-model-upgrade` — `knowledge-index → scheduler` (drain + reindex + atomic alias swap)

## Recipe contract

```ts
// recipe.ts
import { bus, jobs } from '@multimarcdown/core';

// Subscribe to a trigger event and dispatch the next handler in the chain.
// Never embed domain logic here — push it back into the originating capability.
```

A recipe is a wire diagram. If you find yourself writing a transformation, an HTTP call, or anything provider-specific, it belongs in a capability or adapter, not here.
