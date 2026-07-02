# intake-pipeline · sharp edges

Known failure modes specific to this capability. Read before editing the storage or routing paths.

## 1. Hash-before-store is mandatory

Streaming sha256 must complete before the storage PUT returns success, otherwise a dup-detection race lets two parallel uploads of the same file each write to storage. Use a temp key, hash while streaming (`hashStream` in `@multimarcdown/core/checksums`), then `mv` to `cas://sha256/<hash>` atomically. Post-write hashing is wrong.

## 2. MIME sniffing must use magic bytes, not the Content-Type header

`bulk-media-import` documented the failure mode: RoofLink's SPA returned HTML with HTTP 200 + `Content-Type: image/jpeg`. Intake re-sniffs every byte stream with `sniffMime` (`@multimarcdown/core/mime-sniff`) and refuses to store mismatches with `intake.object.rejected{reason:'malformed'}`. The header is a hint, never the truth.

## 3. `source` is open-ended, but `sourceMeta` must round-trip

Every consumer (especially `bulk-media-import`'s D1 INSERT downstream) needs the original `rooflink_job_id` / `gmail_messageId` to deduplicate against legacy data. Drop `sourceMeta` and you re-import duplicates on every retry.

## 4. `intake.object.received` fires BEFORE `intake.object.stored`

Consumers that read bytes must wait for `stored`; receiving only signals "we know about it", not "you can `GET /bytes` now." A naive subscriber that fetches bytes on `received` will race the storage write and 404 intermittently.

## 5. The route table is a default, not a contract

Deployments override `DEFAULT_INTAKE_ROUTES`. Don't hard-code `application/pdf → document-ingestion` in any downstream code; subscribe to `intake.object.routed { targetCapability }` instead, and only run if the routed target matches your capability id.
