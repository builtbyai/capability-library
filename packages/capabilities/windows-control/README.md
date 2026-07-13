# windows-control · _planned_

UIA semantic clicking + OCR + template match + window mgmt via the node-a broker pattern (port 9900 + bearer tokens with scope-graded permissions).

**Surfaces:** WindowList, UiaTreeViewer, OcrTargetPicker, TemplateMatchPanel, ActionScopeBadge
**Emits:** `wctl.action.completed`, `wctl.action.denied`, `wctl.uia.click.miss`, `wctl.ocr.completed`
**Depends on:** fleet-control

See `docs/sharp-edges.md` for project-specific landmines (encoded from user memories).
