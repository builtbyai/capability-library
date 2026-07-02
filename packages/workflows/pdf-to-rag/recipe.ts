/**
 * pdf-to-rag — intake-pipeline → document-ingestion → knowledge-index.
 *
 * Wiring only. Domain logic lives in the composed capabilities.
 */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';
import { IntakeObjectRouted } from '../../capabilities/intake-pipeline/contracts/events.js';

const CAPABILITY_ID = 'document-ingestion';

export function register(): () => void {
  return bus.on('intake.object.routed', async (e: CoreEvent) => {
    const parsed = IntakeObjectRouted.safeParse(e.payload);
    if (!parsed.success) return;
    if (parsed.data.targetCapability !== CAPABILITY_ID) return;
    await jobs.enqueue('document-ingestion', 'ingest', { intakeObjectId: parsed.data.objectId });
    // knowledge-index subscribes to document.chunked itself; no further wiring needed here.
  });
}
