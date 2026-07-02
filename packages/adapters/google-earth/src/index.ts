/**
 * @multimarcdown/adapter-google-earth — KML implementation of the geo-visualization export port.
 *
 * Serializes normalized GeoFeatures to KML for Google Earth import/export.
 */
export interface KmlFeature {
  name: string;
  description?: string;
  coordinates: [number, number] | [number, number][];
}

export interface GoogleEarthAdapter {
  toKml(features: KmlFeature[], docName?: string): string;
  fromKml(kml: string): KmlFeature[];
}

export function createGoogleEarthAdapter(): GoogleEarthAdapter {
  throw new Error('adapter-google-earth: not implemented — KML serialize/parse pending');
}
