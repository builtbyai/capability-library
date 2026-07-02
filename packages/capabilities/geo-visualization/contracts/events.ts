/**
 * geo-visualization contracts. Provider-agnostic geometry; renderers
 * (Leaflet, Google Earth) live in packages/adapters.
 *
 * INVARIANT: internal coordinate order is GeoJSON `[lng, lat]`. Leaflet's
 * `[lat, lng]` conversion happens ONLY in the leaflet adapter — never inline.
 */
import { z } from 'zod';

export const PointSchema      = z.object({ type: z.literal('Point'),      coordinates: z.tuple([z.number(), z.number()]) });
export const LineStringSchema = z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) });
export const PolygonSchema    = z.object({ type: z.literal('Polygon'),    coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(4)) });
export const GeometrySchema = z.discriminatedUnion('type', [PointSchema, LineStringSchema, PolygonSchema]);
export type Geometry = z.infer<typeof GeometrySchema>;

export const GeoSourceSchema = z.object({
  type: z.enum(['pdf', 'email', 'manual', 'api', 'kml', 'geojson']),
  sourceId: z.string(),
});

export const GeoFeatureSchema = z.object({
  featureId: z.string().uuid(),
  layerId: z.string().uuid(),
  geometry: GeometrySchema,
  properties: z.record(z.unknown()).default({}),
  source: GeoSourceSchema.optional(),
});
export type GeoFeature = z.infer<typeof GeoFeatureSchema>;

export const GeoLayerCreatedSchema   = z.object({ layerId: z.string(), name: z.string(), createdAt: z.string() });
export const GeoLayerImportedSchema  = z.object({ layerId: z.string(), format: z.enum(['kml','geojson']), featureCount: z.number(), warnings: z.array(z.string()).default([]) });
export const GeoLayerExportedSchema  = z.object({ layerId: z.string(), format: z.enum(['kml','geojson']), featureCount: z.number(), at: z.string() });
export const GeoFeatureCreatedSchema = GeoFeatureSchema;
export const GeoFeatureUpdatedSchema = z.object({ featureId: z.string(), changes: z.record(z.unknown()) });
export const GeoFeatureDeletedSchema = z.object({ featureId: z.string() });
export const GeoFeatureSelectedSchema= z.object({ featureId: z.string(), at: z.string() });
export const GeoPlaceGeocodedSchema  = z.object({ query: z.string(), coordinates: z.tuple([z.number(), z.number()]), provider: z.string(), confidence: z.number() });
export const GeoKmlWatchRefreshedSchema = z.object({ layerId: z.string(), sourceUrl: z.string(), changed: z.boolean(), featureCount: z.number() });

export const EVENT_NAMES = {
  layerCreated:    'geo.layer.created',
  layerImported:   'geo.layer.imported',
  layerExported:   'geo.layer.exported',
  featureCreated:  'geo.feature.created',
  featureUpdated:  'geo.feature.updated',
  featureDeleted:  'geo.feature.deleted',
  featureSelected: 'geo.feature.selected',
  placeGeocoded:   'geo.place.geocoded',
  kmlWatchRefreshed: 'geo.kml.watch.refreshed',
} as const;

export interface GeoVisualizationPort {
  createLayer(name: string): Promise<{ layerId: string }>;
  importKml(layerId: string, kml: string): Promise<{ featureCount: number; warnings: string[] }>;
  exportKml(layerId: string): Promise<string>;
  geocode(query: string): Promise<{ coordinates: [number, number]; confidence: number; provider: string } | null>;
}
