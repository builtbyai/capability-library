/** web-bookmark-to-notes -- web-clipper -> intake-pipeline -> document-ingestion -> knowledge-index. */
import { jobs } from '@multimarcdown/core';

export interface WebBookmarkInput { url: string; templateId?: string }

/** Workflow entrypoint. Caller invokes via API or a scheduler tick. */
export async function run(input: WebBookmarkInput): Promise<{ clipId: string; intakeObjectId: string }> {
  const clip = await jobs.run<{ clipId: string; intakeObjectId: string }>('web-clipper', 'clip', input);
  // intake-pipeline emits intake.object.routed when the markdown reaches text/markdown route;
  // document-ingestion subscribes and emits document.chunked; knowledge-index embeds.
  return clip;
}
