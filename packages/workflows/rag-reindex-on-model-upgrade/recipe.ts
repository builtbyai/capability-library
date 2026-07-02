/** rag-reindex-on-model-upgrade -- drain old index, embed with new model, atomic alias swap. */
import { jobs } from '@multimarcdown/core';

export interface ReindexInput { newEmbedModel: string; newDim: number }

export async function run(input: ReindexInput): Promise<{ runId: string }> {
  return jobs.run<{ runId: string }>('knowledge-index', 'reindex', {
    reason: 'model-upgrade',
    newEmbedModel: input.newEmbedModel,
    newDim: input.newDim,
  });
}
