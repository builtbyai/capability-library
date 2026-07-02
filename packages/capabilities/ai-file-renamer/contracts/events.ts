/**
 * ai-file-renamer contracts — dry-run-first. Naming inference goes through the
 * ModelInvocation port from @multimarcdown/core, not bound to a provider.
 * Rename apply/rollback uses DryRunTransaction from @multimarcdown/core/dry-run.
 */
import { z } from 'zod';

export const RenameConflict = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('target_exists'), targetPath: z.string() }),
  z.object({ type: z.literal('invalid_chars'), chars: z.array(z.string()) }),
  z.object({ type: z.literal('duplicate_in_batch'), duplicateProposalId: z.string() }),
  z.object({ type: z.literal('case_only_change'), targetPath: z.string() }),
]);

export const RenameProposal = z.object({
  proposalId: z.string(),
  batchId: z.string(),
  originalPath: z.string(),
  proposedPath: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
  detectedMetadata: z.object({
    date: z.string().optional(),
    client: z.string().optional(),
    project: z.string().optional(),
    documentType: z.string().optional(),
    version: z.string().optional(),
  }),
  conflict: RenameConflict,
});
export type RenameProposal = z.infer<typeof RenameProposal>;

export const FilesScannedEvent     = z.object({ event: z.literal('files.scanned'), batchId: z.string(), root: z.string(), count: z.number().int(), at: z.string() });
export const RenameProposedEvent   = z.object({ event: z.literal('file.rename.proposed'), proposal: RenameProposal, at: z.string() });
export const RenameApprovedEvent   = z.object({ event: z.literal('file.rename.approved'), proposalId: z.string(), at: z.string() });
export const RenamedEvent          = z.object({ event: z.literal('file.renamed'), proposalId: z.string(), originalPath: z.string(), newPath: z.string(), at: z.string() });
export const RenameFailedEvent     = z.object({ event: z.literal('file.rename.failed'), proposalId: z.string(), error: z.string(), at: z.string() });
export const RenameRolledBackEvent = z.object({ event: z.literal('file.rename.rolled-back'), batchId: z.string(), restored: z.number().int(), at: z.string() });

export const EVENT_NAMES = {
  scanned:    'files.scanned',
  proposed:   'file.rename.proposed',
  approved:   'file.rename.approved',
  renamed:    'file.renamed',
  failed:     'file.rename.failed',
  rolledBack: 'file.rename.rolled-back',
} as const;

export interface RenamePort {
  scan(input: { root: string }): Promise<{ batchId: string; count: number }>;
  propose(batchId: string): Promise<RenameProposal[]>;
  apply(batchId: string, approvedProposalIds: string[]): Promise<{ applied: number; failed: Array<{ proposalId: string; error: string }> }>;
  rollback(batchId: string): Promise<{ restored: number }>;
}
