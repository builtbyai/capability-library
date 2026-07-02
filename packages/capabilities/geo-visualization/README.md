# geo-visualization  ·  _planned_

Store normalized GeoFeatures; render through adapters. Leaflet and Google Earth
are renderers, not the model.

**Surfaces:** MapCanvas, LayerControl, MarkerClusterLayer, GeoJsonLayer, KmlLayer, DrawingTools, PlaceSearchBox, CoordinateInspector
**Emits:** `geo.feature.created`, `geo.layer.imported`, `geo.place.geocoded`, `geo.feature.selected`
**Adapters:** leaflet-renderer · google-earth-kml-export · geocoder

**Canonical model** (`contracts/events.ts`):
```ts
type GeoFeature = {
  featureId: string; layerId: string;
  geometry:
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'Polygon'; coordinates: [number, number][][] };
  properties: Record<string, unknown>;
  source?: { type: 'pdf' | 'email' | 'manual' | 'api' | 'kml' | 'geojson'; sourceId: string };
};
```

**Boundary rule:** persist normalized GeoFeatures; render in Leaflet, export KML
for Google Earth, import KML back — all via adapters over one `GeoLayerPort`.
