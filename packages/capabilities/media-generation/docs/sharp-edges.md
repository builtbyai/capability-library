# media-generation · sharp edges

## 1. Backends produce different aspect-ratio defaults

DALL-E 3 = 1024x1024 default; Replicate SDXL = 1024x1024 but most fine-tunes are 768x768; Flux dev = 1024x1024 but won't scale below 256. Standardize on the requested size at the port boundary and let the adapter handle the upscale/crop.

## 2. Cost can explode with one prompt

A single Replicate Flux-dev run on an A100 is ~$0.04. A "generate 100 variants" batch hits $4 instantly. Enforce `MEDIA_GEN_BUDGET_USD_DAILY` at the dispatch layer; refuse runs that would exceed it.

## 3. Provider rate-limits are per-token, not global

Replicate caps `predictions.create` at 600/min PER TOKEN. If two capabilities share the token, both hit the same cap. Track per-token QPS in CostLedger and surface in dashboard before failure.

## 4. Generated PNGs may contain provider watermarks

Stability AI and fal.ai default to a small watermark in the corner. Detect via region-OCR; flag the asset; surface in UI.

## 5. NSFW filters are per-provider + per-model

OpenAI rejects at the prompt; Replicate rejects at output (after billing). Track refunds via `gen.run.refunded` event; some providers don't refund automatically.

