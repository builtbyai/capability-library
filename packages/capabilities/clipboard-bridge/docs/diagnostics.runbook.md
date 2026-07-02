# clipboard-bridge · diagnostics runbook

## Rung 1 — clipboardy reads

```bash
node -e "console.log(require('clipboardy').readSync())"
```

No throw + prints current clipboard. Linux without `xclip` / `wl-paste` installed throws — install the right helper for the session type.

## Rung 2 — snapshot roundtrip

```bash
curl -X POST http://127.0.0.1:5108/api/clipboard/snapshot
```

Expect 200 + `{ snapshotId, kind, contentHash, intakeObjectId }`. Compare `contentHash` to `sha256` of what you actually had on the clipboard.

## Rung 3 — history retention

```bash
curl 'http://127.0.0.1:5108/api/clipboard/history?limit=5'
```

Expect last 5 snapshots. If `CLIPBOARD_HISTORY_LIMIT=100` but you see only 3, the file is being rotated wrong; check `MMD_CLIPBOARD_DB` permissions.

## Symptom → cause

| Symptom | Cause |
|---|---|
| Linux: snapshot hangs | `xclip` / `wl-paste` missing or wrong (X11 vs Wayland session). |
| Image hashes differ between machines | OS normalization skipped (sharp-edges #4). |
| Captured a password from 1Password | Deny-list not applied (sharp-edges #2). |
| User lost unsaved clipboard contents | Push path didn't snapshot first (sharp-edges #5). |
