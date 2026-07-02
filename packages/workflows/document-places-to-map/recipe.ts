/** document-places-to-map -- document-ingestion (extracted addresses) -> geo-visualization. */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';

interface DocumentPlaceExtractedPayload {
  documentId: string;
  place: { query: string };
  layerId?: string;
}

export function register(): () => void {
  return bus.on('document.place.extracted', async (e: CoreEvent) => {
    const p = e.payload as DocumentPlaceExtractedPayload;
    const layerId = p.layerId ?? p.documentId;
    const geo = await jobs.run<{ coordinates: [number, number] } | null>('geo-visualization', 'geocode', { query: p.place.query });
    if (!geo) return;
    await jobs.enqueue('geo-visualization', 'addFeature', {
      layerId,
      geometry: { type: 'Point', coordinates: geo.coordinates },
      properties: { documentId: p.documentId, query: p.place.query },
      source: { type: 'pdf', sourceId: p.documentId },
    });
  });
}
