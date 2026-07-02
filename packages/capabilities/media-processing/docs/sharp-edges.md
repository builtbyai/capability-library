# media-processing · sharp edges

## 1. Replicate output URLs expire in 1 hour
Download bytes inside the prediction handler, NOT on a later sweep. Variant store must hold its own copy.

## 2. `replicate.delivery` requires bearer auth
Variant downloader must reuse the `ReplicateClient`, not raw `fetch`.

## 3. `sharp` HEIC/AVIF depends on libvips build
Some `sharp` binary builds skip HEIC. Verify at health-check time; do not assume.

## 4. `assetId.hash` collision under concurrent upload
Two clients uploading the same bytes simultaneously must converge on ONE assetId. Use hash as assetId, or a unique constraint at the persistence layer.

## 5. Original is sacrosanct
`DryRunTransaction.revert` MUST only touch variants. A bug here trashes user data. Add a runtime invariant: `originalUri` sha256 must be identical pre and post a full apply+rollback cycle.
