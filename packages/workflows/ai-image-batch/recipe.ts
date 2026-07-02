/** ai-image-batch -- Parallel-think a prompt to generate N stylistically diverse variants (e.g. 'logo with adversarial + first-principles + empirical angles') -> judge picks the best -> notify on completion. */
import { jobs } from '@multimarcdown/core';

export interface AiImageBatchInput {
  prompt: string;
  fanout?: number;
  capabilityId: string;
}

export async function run(input: AiImageBatchInput): Promise<{ runId: string; angles: string[] }> {
  // First: parallel-think generates N angle-specific variants of the prompt.
  const orch = await jobs.run<{ runId: string; angles: Array<{ text: string }> }>('ai-orchestration', 'parallel-think', {
    strategy: 'parallel-think',
    prompt: `Generate ${input.fanout ?? 3} distinct prompt-rewrites for: ${input.prompt}`,
    fanout: input.fanout ?? 3,
    capabilityId: input.capabilityId,
  });

  // Then: dispatch one image-gen run per angle.
  for (const angle of orch.angles) {
    await jobs.enqueue('media-generation', 'image', { prompt: angle.text });
  }
  return { runId: orch.runId, angles: orch.angles.map(a => a.text) };
}
