/** clipboard-to-intake -- clipboard-bridge -> intake-pipeline (already wired via the capability itself).
 *  This workflow exists as a discovery anchor; the snapshot path inside clipboard-bridge already
 *  calls IntakePort.ingestUpload(). No extra wiring needed; recipe is a no-op observer. */
import { bus, type CoreEvent } from '@multimarcdown/core';

export function register(): () => void {
  return bus.on('clipboard.snapshot.captured', async (_e: CoreEvent) => {
    // clipboard-bridge already emits intake.object.received during snapshot.
    // This subscription is a place to add additional fan-out (e.g. immediate web-clipper expansion
    // when the snapshot is a URL).
  });
}
