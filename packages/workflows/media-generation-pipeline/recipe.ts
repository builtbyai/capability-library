/** media-generation-pipeline -- Generate N images from a prompt -> auto-upscale via media-processing -> stage in intake-pipeline -> archive to cloud-storage with share link. */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';

export interface MediaGenPipelineInput {
  prompt: string;
  count: number;
  bucket?: string;
}

export async function run(input: MediaGenPipelineInput): Promise<{ runId: string }> {
  const { runId } = await jobs.run<{ runId: string }>('media-generation', 'image', {
    prompt: input.prompt,
    count: input.count,
  });

  // Downstream wiring: gen.asset.created -> media-processing upscale -> cloud-storage archive
  // happens automatically because each capability subscribes to upstream events.
  return { runId };
}

export function register(): () => void {
  return bus.on('gen.asset.created', async (e: CoreEvent) => {
    const payload = e.payload as { assetId: string; intakeObjectId: string };
    await jobs.enqueue('media-processing', 'upscale', { intakeObjectId: payload.intakeObjectId });
  });
}
