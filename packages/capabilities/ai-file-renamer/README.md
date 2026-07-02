# ai-file-renamer  ·  _planned_

Infer canonical filenames, preview, detect conflicts, apply or rollback.

**Surfaces:** RenameDropzone, RenamePreviewTable, ConflictResolver, RenameRuleEditor, DryRunApplyBar
**Emits:** `files.scanned`, `file.rename.proposed`, `file.rename.approved`, `file.renamed`, `file.rename.failed`

**Canonical model** (`contracts/events.ts`):
```ts
type RenameProposal = {
  proposalId: string; batchId: string;
  originalPath: string; proposedPath: string;
  confidence: number; rationale: string;
  detectedMetadata: { date?: string; client?: string; project?: string; documentType?: string; version?: string };
  conflict:
    | { type: 'none' }
    | { type: 'target_exists'; targetPath: string }
    | { type: 'invalid_chars'; chars: string[] }
    | { type: 'duplicate_in_batch'; duplicateProposalId: string };
};
```

**Critical rule:** **dry-run first.** Produce a proposed transaction; mutate the
filesystem only on explicit apply, and keep a rollback log.
