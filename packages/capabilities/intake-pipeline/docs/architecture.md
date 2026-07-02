# intake-pipeline · architecture

The intake pipeline is content-addressable. `objectId` is a UUID used for routing; `contentHash` is the sha256 of the bytes used for dedup. The original bytes are immutable — downstream capabilities create their own derived records keyed by `objectId` but never mutate an `IntakeObject`.

## Storage drivers

`INTAKE_STORAGE_DRIVER` selects how bytes are stored. Three drivers ship:

- `fs` — local filesystem rooted at `INTAKE_STORAGE_ROOT`. Files land at `cas/<first2>/<sha256>`.
- `r2` — Cloudflare R2 (S3 API). Key shape: `cas/<sha256>`. Used in production.
- `s3` — generic S3-compatible. Same key shape.

Drivers implement the `StorageDriver` port (write, read-stream, head, delete). The driver is the only thing that knows how to talk to storage; the rest of the capability is provider-agnostic.

## Routing

After `intake.object.stored` fires, the router consults the MIME-to-capability table (`DEFAULT_INTAKE_ROUTES` in `@multimarcdown/core/intake`, overridable per deployment) and emits `intake.object.routed` once per matching downstream. Multi-target routing is supported (an `image/png` could go to both `media-processing` and `geo-visualization` if EXIF GPS is present).

## Event ordering invariant

`intake.object.received` fires immediately on POST — it means "we know about it." `intake.object.stored` fires only after bytes are durable. Consumers that need to read bytes MUST subscribe to `stored`, not `received`. Subscribing to `received` is fine if you only care that "a thing arrived."

## What this capability does NOT do

It does not extract, summarize, transform, embed, OCR, or normalize content. Those are downstream capabilities' jobs (document-ingestion, media-processing, knowledge-index). Intake's job ends at routing.
