# cloud-storage · sharp edges

## 1. R2 is flat — folder semantics are a UX lie

There is no `mkdir`. A "folder" is a key prefix with `/` separator. Empty folders cannot exist (no zero-byte key to anchor them). Either store a `.keep` sentinel on create-folder OR document that folders only exist when they contain ≥1 object.

## 2. Share links must expire

Cloudflare R2 signed URLs default to 7-day max via the API. If you UI promises "share forever", you're lying — surface the expiry to the user, and proactively rotate before expiry for "permanent" shares.

## 3. Delete is soft-delete

A real delete on R2 is irreversible. Move to a `_trash/<original-key>` prefix; reaper job expires per `CLOUD_STORAGE_TRASH_RETENTION_DAYS`. This is the Google Drive model and is the only safe default.

## 4. Wrangler vs AWS SDK is a 28x speed gap

Per `bulk-media-import` sharp-edges: `wrangler r2 object put` is 1.5s/object; AWS SDK direct PUT is 50ms. For uploads >50 objects, the cap MUST dispatch to bulk-media-import, never wrangler.

## 5. Google Drive cross-sync is OAuth-fragile

Google's Drive OAuth refresh tokens expire weekly in Testing mode and become invalid after a password change. Cross-sync MUST retry on 401 by triggering a re-auth flow, not silently failing.

## 6. Quota math is per-bucket, not per-account

Class A operations (PUT/POST) and Class B (GET/HEAD) are billed separately; egress is free to Cloudflare network, paid otherwise. Display per-class counters in the quota card, not just total bytes.

