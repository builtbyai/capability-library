/** audio-to-rag -- intake (audio/video) -> transcription -> knowledge-index. */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';
import { IntakeObjectRouted } from '../../capabilities/intake-pipeline/contracts/events.js';

export function register(): () => void {
  return bus.on('intake.object.routed', async (e: CoreEvent) => {
    const parsed = IntakeObjectRouted.safeParse(e.payload);
    if (!parsed.success) return;
    const m = parsed.data.mimeType;
    if (!m.startsWith('audio/') && !m.startsWith('video/')) return;
    await jobs.enqueue('transcription', 'run', {
      intakeObjectId: parsed.data.objectId,
      diarize: true,
    });
    // transcription emits transcription.completed; knowledge-index subscribes to chunk events itself.
  });
}
