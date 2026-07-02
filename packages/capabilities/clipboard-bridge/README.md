# clipboard-bridge · _planned_

OS clipboard ↔ intake. The `clipboard` source was already enumerated in `@multimarcdown/core/intake.ts` but no capability owned it. This closes the gap.

**Surfaces:** ClipboardSnapshotButton, ClipboardHistoryDrawer, PasteTargetPicker
**Emits:** `clipboard.snapshot.captured`, `clipboard.write.requested`, `clipboard.write.completed`
**Depends on:** intake-pipeline

## Two directions

**Pull (snapshot → intake):** user copies text/image/HTML/file-list, hits the dashboard hotkey, the capability snapshots the current clipboard, hashes it, stages an IntakeObject, and emits `clipboard.snapshot.captured`. Downstream caps treat it like any other intake.

**Push (write back to clipboard):** other capabilities (ai-file-renamer suggesting a name, web-clipper rendering markdown, deepseek-router returning a completion) can write their output back to the clipboard so the user pastes it into the source app.

## Why not just `mcp__claude-in-chrome__shortcuts_execute`?

Because the existing skills handle one direction at a time and don't dedup, hash, or stage to intake. This capability gives clipboard a first-class place in the catalog so it benefits from the same routing + observability as URLs and uploads.
