# ai-file-renamer · sharp edges

## 1. Windows path case-insensitivity
`fs.rename('Foo.txt', 'foo.txt')` is a no-op on NTFS. Engine MUST detect case-only changes and either skip them or do a 2-step rename (`Foo.txt → Foo.txt.tmpcase → foo.txt`). Track as a `case_only_change` conflict variant.

## 2. Conflict window between propose and apply
Another process may create the target path between preview and apply. Re-check at apply time — never trust the preview's `conflict` field.

## 3. AI proposals collide silently
Two unrelated files inferring the same canonical name = `duplicate_in_batch`. The engine MUST reject the batch, not pick a winner.

## 4. ModelInvocation costs accrue per scan
Every proposed name is one AI call. A 5000-file scan with no cap = $$$. Cache by `sha256(originalPath + sampleBytes)` so re-scanning the same tree is free.
