# geo-visualization · diagnostics runbook

## Rung 1 — geocoder probe
Geocode '1600 Amphitheatre Pkwy Mountain View CA' → coords within 100m of (37.4220, -122.0841). Failure = `GEOCODER_API_KEY` missing or rate-limited.

## Rung 2 — KML roundtrip
Import sample.kml, export, diff. Feature count must match. Mismatch = `gx:` extensions dropped silently.

## Rung 3 — coord-axis sanity
`GET /api/geo/layers/:id` first feature's `coordinates[0]` — must be `[-180,180]` (lng-first), not `[-90,90]` (lat-first).

## Symptom → cause
| Symptom | Cause |
|---|---|
| KML import shows fewer features | Sharp-edges #2 (gx: extensions). |
| Map renders blank | Coord axis swap (sharp-edges #1). |
| Geocoder bill spike | Cache bypass (sharp-edges #3). |
