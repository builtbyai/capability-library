# storm-data · _planned_

Pull weather + storm event data from multiple providers (NOAA, HailTrace, RoofLink, OpenWeatherMap, NWS) keyed by location/date. Normalized records feed ImpactIQ claim-file generation. Includes per-provider rate-limit + cache layer.

**Surfaces:** StormMapView, StormEventCard, ProviderStatusGrid, DateRangePicker, HailSizeFilter
**Emits:** `storm.query.completed`, `storm.event.matched`, `storm.cache.refreshed`, `storm.provider.degraded`
**Jobs:** `storm-data:query`, `storm-data:cache-refresh`
**Depends on:** connector-config, geo-visualization, intake-pipeline

See `docs/sharp-edges.md` for project-specific landmines.
