/** bulk-rename-folder -- scheduler -> ai-file-renamer (scan + propose + apply with rollback). */
import { jobs } from '@multimarcdown/core';

export interface BulkRenameInput { root: string; autoApprove?: boolean }

export async function run(input: BulkRenameInput): Promise<{ batchId: string }> {
  const { batchId } = await jobs.run<{ batchId: string }>('ai-file-renamer', 'scan', { root: input.root });
  await jobs.enqueue('ai-file-renamer', 'propose', { batchId });
  if (input.autoApprove) {
    await jobs.enqueue('ai-file-renamer', 'apply', { batchId });
  }
  return { batchId };
}
