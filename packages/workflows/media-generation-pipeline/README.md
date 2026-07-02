# media-generation-pipeline

**Composes:** media-generation, media-processing, intake-pipeline, cloud-storage
**Trigger:** POST /api/workflow/media-gen { prompt, count }
**Summary:** Generate N images from a prompt -> auto-upscale via media-processing -> stage in intake-pipeline -> archive to cloud-storage with share link.

Wiring recipe; see `recipe.ts`.
