# clipboard-bridge · architecture

## Snapshot path

```
hotkey/button → readNative() → detect kind (text/html/image/file-list)
                              → hashStream (image) or hashBytes (text)
                              → write to CAS via IntakePort.ingestUpload
                              → emit clipboard.snapshot.captured
```

`readNative()` is implemented per-platform: Win32 `OpenClipboard` + `GetClipboardData`, AppKit `NSPasteboard`, X11 `xclip` / Wayland `wl-paste`. Detection priority: image > html > file-list > text.

## Write path

```
caller emits clipboard.write.requested { text, source }
              ↓
writeNative(text)              (synchronous; OS clipboard is a global resource)
              ↓
emit clipboard.write.completed
```

History: per-user JSONL log (max `CLIPBOARD_HISTORY_LIMIT` entries, default 100). Drops oldest. Image entries link to the CAS object — the JSONL only holds metadata.
