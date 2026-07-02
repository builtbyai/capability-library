# widget-framework · _planned_

Drag-and-drop resizable widget grid for dashboards. Includes ResizableWidget primitive + Sidebar + Header + CommandPalette + ContextMenu + Notifications primitives. Sourced from `dashboard_v5/src/components/`. Workspace-aware (per-user layout persistence).

**Surfaces:** ResizableWidget, WidgetGrid, CommandPalette, ContextMenu, Sidebar, Header, Notifications, LayoutEditor
**Emits:** `widget.added`, `widget.removed`, `widget.moved`, `widget.resized`, `layout.saved`
**Jobs:** `widget-framework:persist-layout`, `widget-framework:reset-defaults`
**Depends on:** (none)

See `docs/sharp-edges.md` for project-specific landmines.
