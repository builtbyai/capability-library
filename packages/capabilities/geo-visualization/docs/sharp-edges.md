# geo-visualization · sharp edges

## 1. Coordinate order chaos
GeoJSON = `[lng, lat]`; KML = `lng,lat,alt`; Leaflet = `[lat, lng]`. Internal model MUST be GeoJSON order. Conversion to Leaflet happens only in the leaflet adapter via a single `toLeafletLatLng()` — never inline swaps.

## 2. KML namespace soup
Google Earth uses `gx:` extensions that `@tmcw/togeojson` drops silently. Re-exporting an imported KML is smaller than the input. Surface `warnings[]` on import; never claim KML→GeoJSON→KML is lossless.

## 3. Geocoder cost spike
Google Maps Geocoding bills per request. A `MapCanvas` with 5000 unresolved places = $50 on first render. Cache by `sha256(query)`; never bypass.

## 4. Polygon winding order
GeoJSON spec: outer ring CCW, inner CW. KML doesn't care. Import → export pipeline can produce polygons that mapbox-gl / deck.gl draw inside-out. Normalize on ingest.

## 5. `geo.feature.selected` event fan-out
10k features × careless consumer (knowledge-index re-queries on every click) = UI freeze. Throttle this event specifically to 100ms at the bus boundary.
