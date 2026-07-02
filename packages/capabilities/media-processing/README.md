# media-processing  ·  _planned_

Upscale / denoise / transcode media into variants with provenance.

**Surfaces:** MediaUploadPanel, BeforeAfterCompare, VariantGrid, ProcessingStatus, ExportButton
**Emits:** `media.uploaded`, `media.processing.started`, `media.variant.created`, `media.processing.failed`

**Canonical models** (`contracts/events.ts`):
```ts
type MediaAsset = { assetId: string; originalUri: string; mimeType: string; width?: number; height?: number; hash: string; createdAt: string };
type MediaVariant = {
  variantId: string; assetId: string;
  operation: 'upscale' | 'denoise' | 'compress' | 'format-convert';
  provider: string; outputUri: string; width?: number; height?: number; createdAt: string;
};
```

**Critical rule:** **never overwrite the original.** Every generated file is a
variant that points back to its source asset.
