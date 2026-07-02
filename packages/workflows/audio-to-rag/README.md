# audio-to-rag

**Composes:** transcription, intake-pipeline, knowledge-index
**Trigger:** intake.object.routed{audio/* | video/*}
**Summary:** Audio/video uploaded -> transcribed -> segments chunked -> embedded for RAG

This is a wiring recipe. It contains no domain logic.

See [packages/workflows/README.md](../README.md) for the workflow contract.
