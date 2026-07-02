/** rooflink-backfill-to-rag -- bulk-media-import (--emit-intake) -> intake -> doc/media -> knowledge-index. */
import { bus, type CoreEvent } from '@multimarcdown/core';

export function register(): () => void {
  return bus.on('bulk-import.file.uploaded', async (_e: CoreEvent) => {
    // bulk-media-import already emits intake.object.received per file when --emit-intake is set.
    // intake-pipeline router fans out to document-ingestion (PDFs) and media-processing (images).
    // No additional wiring needed here -- this recipe exists to make the composition discoverable.
  });
}
