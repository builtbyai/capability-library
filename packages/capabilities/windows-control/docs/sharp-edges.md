# windows-control · sharp edges

## 1. iCUE5 WebView2 parent handle is always 0

Per CLAUDE.md `gui server on this machine` block: parent iCUE.exe has MainWindowHandle=0 with zero windows. NORMAL. The visible window is owned by a child msedgewebview2.exe. Iterate child PIDs.

## 2. Bearer tokens are scope-graded

Two tokens live in `~/.claude/secrets/gui-node-a{,-admin}.token`. Read = anyone; write/restart = admin. Mixing them up = silent 403.

## 3. UIA tree dump is heavy

Capturing the full UIA tree for a Chrome window with 1000 DOM nodes can be 50MB. Filter by `ControlType` server-side; never stream the raw tree across LAN.

## 4. OCR template match is brittle across DPI

Same screenshot at 100% vs 150% DPI scaling produces different template-match coordinates. Always normalize to a reference DPI before matching.

## 5. Some Windows hotkeys go through PowerToys

Per `node-a_powertoys_color_picker_winshiftc.md`, PowerToys owns Win+Shift+C. Hotkey conflicts MUST check PowerToys settings before assigning new global hotkeys.

