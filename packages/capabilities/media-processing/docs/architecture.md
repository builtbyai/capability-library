# media-processing · architecture

`upload(asset, hash) → process(assetId, op) → dispatch to provider adapter (replicate / ffmpeg) → stage output to tempfile → DryRunTransaction commits to variant store → emit media.variant.created + CostLedger entry`.

Originals are immutable. Every variant references its source `assetId` and includes provider + providerJobId + cost. Rollback removes the variant; originals are never touched. Replicate output URLs expire in 1h — download bytes inside the prediction handler, not on a later sweep.
