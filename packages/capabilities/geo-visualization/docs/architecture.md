# geo-visualization · architecture

Domain model is GeoJSON-order `[lng, lat]` exclusively. Renderers (Leaflet, Google Earth) are adapters and own the conversion to their preferred coordinate order. KML import via `@tmcw/togeojson`, export via `tokml`.

Geocoder is per-deployment via `connector-config` (google_maps, custom_api). Cache keyed by `sha256(query)` — cold lookups never bypass cache. Per-layer "watch KML URL" runs via `scheduler` (`geo-visualization:refreshKml` cron).
