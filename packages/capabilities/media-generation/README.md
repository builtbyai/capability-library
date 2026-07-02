# media-generation · _planned_

Text-to-image / text-to-video / image-to-image generation via pluggable backends (Replicate, OpenAI DALL-E, Stable Diffusion local, fal.ai). Generated assets land in intake-pipeline so document-ingestion + media-processing pick them up like any other input.

**Surfaces:** GenerationPanel, PromptHistoryTable, BackendPicker, AssetGrid, PromptTemplateEditor, CostMeter
**Emits:** `gen.run.started`, `gen.asset.created`, `gen.run.completed`, `gen.run.failed`, `gen.run.refunded`
**Jobs:** `media-generation:image`, `media-generation:video`, `media-generation:upscale`
**Depends on:** replicate-api, intake-pipeline, connector-config

See `docs/sharp-edges.md` for project-specific landmines.
