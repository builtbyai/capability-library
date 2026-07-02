/**
 * @multimarcdown/adapter-leaflet — Leaflet implementation of the geo-visualization render port.
 *
 * Turns normalized GeoFeatures into Leaflet layers. This is the browser-side
 * binding; the capability owns the normalized shape, this owns the Leaflet calls.
 */
export interface GeoFeature {
  id: string;
  geometry: { type: 'Point' | 'LineString' | 'Polygon'; coordinates: number[] | number[][] | number[][][] };
  properties?: Record<string, unknown>;
}

export interface LeafletRenderOptions {
  fitBounds?: boolean;
  cluster?: boolean;
}

export interface LeafletAdapter {
  /** Render features into a map instance (an L.Map), returning a layer handle. */
  render(map: unknown, features: GeoFeature[], opts?: LeafletRenderOptions): unknown;
  clear(map: unknown): void;
}

export function createLeafletAdapter(): LeafletAdapter {
  throw new Error('adapter-leaflet: not implemented — depends on the `leaflet` peer dependency');
}
