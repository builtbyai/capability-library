# document-ingestion · architecture

A 7-stage pipeline as a state machine on `DocumentRecord.status`. Each stage emits exactly one event:

```
uploaded → preserving → extracting (pdfjs | OCR | docx-xml) → normalizing → chunking → enriching → indexed
                                                                              ↓
                                                                       (or failed)
```

Triggered by `intake.object.routed{targetCapability:'document-ingestion'}`. The capability fetches the original bytes via `IntakePort.bytes(intakeObjectId)` — it never touches storage directly.

## Workers + concurrency

Tesseract OCR uses a worker pool sized `DOC_INGEST_TESSERACT_WORKERS` (default 2 on a 16GB host). Pages are streamed, never `Promise.all`'d — see sharp-edges #2.

## Chunking

Sliding-window over normalized text with **token-aware** boundaries (cl100k for OpenAI embeddings, sentencepiece for BGE/E5). `tokenCount` MUST match the tokenizer the downstream embedder uses (knowledge-index reads from `EMBED_MODEL` env). Mismatch → embedding API rejects at chunk boundary.

## Failure granularity

`document.page.failed` is per-page, not per-document. One bad page (scanned, encrypted, malformed) doesn't kill the import. `document.ingestion.failed` only fires when the whole document is unrecoverable.
