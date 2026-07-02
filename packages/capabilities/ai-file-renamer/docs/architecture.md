# ai-file-renamer · architecture

`scan(root) → propose(ModelInvocation) → preview UI → apply(DryRunTransaction) → emit file.renamed | rollback restores from rename_history`.

Naming inference goes through `ModelInvocation` from `@multimarcdown/core` (default adapter: deepseek). Engine never calls a provider directly. Apply/rollback uses `DryRunTransaction` so every batch is atomic + reversible.

`rename_history` is JSONL append-only OR D1 row per applied op. On crash mid-apply, restart reads the log and rollback restores the partial set.
