# document-ingestion · diagnostics runbook

## Rung 1 — pdfjs + tesseract probes

```bash
node -e "require('pdfjs-dist/legacy/build/pdf.worker.mjs')"
tesseract --version
```

Both must exit 0. Failure → install/peer-dep regression.

## Rung 2 — queue + oldest pending

```bash
curl http://127.0.0.1:5102/api/documents/_metrics
```

Expect `queueDepth < 50 && oldestPending < 600s`. Long oldestPending → tesseract worker stuck (kill + restart) or a single document is monopolizing workers (lower `DOC_INGEST_TESSERACT_WORKERS`).

## Rung 3 — per-document inspection

```bash
curl http://127.0.0.1:5102/api/documents/<documentId>/pages
```

Lists every page with its `extractionMethod` and (for OCR) `ocrConfidence`. Pages with `extractionMethod: 'pdfjs'` AND `text.length < 50` → likely a scanned page that wasn't routed through OCR (sharp-edges #3).

## Symptom → cause

| Symptom | Likely cause |
|---|---|
| All chunks empty for a document | Scanned PDF, OCR misrouted. Check sharp-edges #3. |
| Indexing succeeded but knowledge-index returns nothing | Tokenizer mismatch between chunker and embedder. Sharp-edges #4. |
| Document stuck at `extracting` for >10 min | Tesseract worker hung on a malformed page. Restart the capability process. |
| Memory keeps growing | Tesseract worker pool too large for host. Lower `DOC_INGEST_TESSERACT_WORKERS`. |
