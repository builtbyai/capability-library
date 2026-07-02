# media-processing · diagnostics runbook

## Rung 1 — provider + tools
`ReplicateClient.account.get()` → 200. `ffmpeg -version` → exit 0. libvips support matrix per `sharp.format`.

## Rung 2 — variant store
`variants_dir` writable + free space > 1GB. Failure = ENOSPC kills mid-process.

## Rung 3 — end-to-end smoke
Upload 1MB test image → upscale via `nightmareai/real-esrgan` → assert variant exists, hash differs, original sha256 unchanged.

## Symptom → cause
| Symptom | Cause |
|---|---|
| Variant download 404 | Replicate URL expired (sharp-edges #1). |
| HEIC upload errors | sharp built without libvips HEIC support. |
| Original bytes changed | Bug in revert callback. Sharp-edges #5 — STOP immediately. |
