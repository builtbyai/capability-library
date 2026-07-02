# clipboard-bridge · sharp edges

## 1. Clipboard is a global, racy resource

Between `readNative()` returning and the consumer using the value, another app can overwrite it. Snapshot captures a SNAPSHOT — the bytes hashed and stored are what the user had at hotkey-press time, NOT what's there 200ms later. Never re-read on consumer demand.

## 2. Sensitive data sits in clipboard long after copy

Password managers (1Password, Bitwarden) auto-clear the clipboard after 30s. Capturing during that 30s window means our CAS store now holds a password. Implement a deny-list of recently-active processes (password managers) — if one is foreground when snapshot fires, refuse the capture and emit `clipboard.snapshot.captured{intakeObjectId: null, reason: 'sensitive_source'}`.

## 3. `clipboardy` is synchronous and blocks the event loop

A 10MB image read can stall the Node main thread for 50-100ms. Snapshot must run in a worker thread or `child_process.fork` for image-kind reads — text/html are small enough to inline.

## 4. Image clipboard differs per OS

Windows returns a DIB (DIBSECTION); macOS returns TIFF; X11 returns PNG. The capability must normalize all to PNG before hashing, or two snapshots of the same image across machines will have different content hashes.

## 5. Write path can blow away unrelated unsaved work

If the user has a half-written email in their clipboard buffer and a capability writes a filename to the clipboard, the email is gone with no recovery. Always snapshot what's currently on the clipboard BEFORE writing, store it in history, so the user can paste it back via the history drawer.
