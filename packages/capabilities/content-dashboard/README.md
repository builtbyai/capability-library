# content-dashboard · _planned_

Unified feed of content emitted by other capabilities (web-clipper notes, generated media, transcribed audio, signed agreements, RoofLink storm imports). Filters by source, tag, date; supports pinning + workflow triggers from the feed.

**Surfaces:** FeedView, FeedItem, FilterSidebar, TagEditor, WorkflowTriggerButton, StatsHeader
**Emits:** `dashboard.item.pinned`, `dashboard.item.tagged`, `dashboard.workflow.triggered`
**Jobs:** `content-dashboard:rebuild-index`, `content-dashboard:digest-daily`
**Depends on:** knowledge-index, intake-pipeline

See `docs/sharp-edges.md` for project-specific landmines.
