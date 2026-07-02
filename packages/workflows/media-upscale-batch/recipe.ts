/** media-upscale-batch -- media-processing -> replicate-api (via core/jobs). */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';
import { IntakeObjectRouted } from '../../capabilities/intake-pipeline/contracts/events.js';

export function register(): () => void {
  return bus.on('intake.object.routed', async (e: CoreEvent) => {
    const parsed = IntakeObjectRouted.safeParse(e.payload);
    if (!parsed.success) return;
    if (parsed.data.targetCapability !== 'media-processing') return;
    await jobs.enqueue('media-processing', 'upscale', { intakeObjectId: parsed.data.objectId });
  });
}
