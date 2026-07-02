# storm-to-rag

**Composes:** storm-data, intake-pipeline, document-ingestion, knowledge-index
**Trigger:** storm.event.matched
**Summary:** When storm-data matches an event near a known property, fetch the full event report -> intake -> chunk -> embed for RAG over historical storm context.

Wiring recipe; see `recipe.ts`.
