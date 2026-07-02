# document-ingestion · sharp edges

## 1. pdfjs-dist worker bundling on Node ≥ 20

You MUST import `pdfjs-dist/legacy/build/pdf.worker.mjs` explicitly, otherwise pdfjs spawns a Web Worker that doesn't exist in Node and silently produces empty pages. CI must `node -e "require('pdfjs-dist/legacy/build/pdf.worker.mjs')"` as a probe.

## 2. Tesseract.js + 500-page PDF without concurrency cap OOMs

Cap concurrent OCR pages to `DOC_INGEST_TESSERACT_WORKERS` (2 on a 16GB box) and STREAM pages — never `Promise.all(pages.map(ocr))`. The job runner's retry policy doesn't help here; this is concurrency, not retry.

## 3. Scanned PDFs return `text=""` from pdfjs WITHOUT erroring

The "is this scanned?" detector must check `totalTextLength / pageCount < 50` and route through OCR fallback. The error is silent — no exception, just blank chunks downstream.

## 4. `tokenCount` MUST use the same tokenizer the embedding model uses

cl100k for OpenAI, sentencepiece for BGE/E5. Off-by-one between chunker and embedder = embedding API rejection at chunk boundary. Pin the tokenizer in `DocumentChunkSchema` metadata if you want runtime verification.

## 5. Chunk boundaries cross pages

A `DocumentChunk` with `pageStart=4, pageEnd=5` is normal — chunking respects token boundaries, not page boundaries. UI consumers that link "chunk → single page" are wrong; use `sourceBoundingBoxes[]` instead.
