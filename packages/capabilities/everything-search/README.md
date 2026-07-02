# everything-search · _planned_

Fast file search across mounted volumes via the Windows `Everything` index (voidtools). On non-Windows hosts, falls back to `fd` / `ripgrep`. Surface a unified search box; results stream as the user types. 80+ CLI helper commands also surfaced as `everything-search:*` jobs.

**Surfaces:** SearchBox, ResultsList, FilterChips, ExtensionPicker, RecentSearches
**Emits:** `search.query.received`, `search.results.delivered`, `search.indexer.refreshed`
**Jobs:** `everything-search:query`, `everything-search:refresh-index`, `everything-search:open-result`
**Depends on:** fleet-control

See `docs/sharp-edges.md` for project-specific landmines.
