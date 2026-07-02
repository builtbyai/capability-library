/** screenshot-to-rag -- screenshot-capture -> intake -> document-ingestion -> knowledge-index. */
import { bus, type CoreEvent } from '@multimarcdown/core';

export function register(): () => void {
  return bus.on('screenshot.normalized', async (_e: CoreEvent) => {
    // intake-pipeline routes image/* MIME to document-ingestion via DEFAULT_INTAKE_ROUTES.
    // document-ingestion runs OCR fallback when text is empty. Chunks flow to knowledge-index.
    // No additional wiring needed -- this recipe exists to make the composition discoverable.
  });
}
