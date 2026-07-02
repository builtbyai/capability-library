# document-ingestion  ·  _planned_

Any PDF → every useful representation → canonical chunks, via a 7-stage pipeline.

**Surfaces:** PdfDropzone, ImportProgressTimeline, ExtractionPreview, PageImageViewer, ChunkInspector, FailedPageReviewPanel
**Emits:** `document.uploaded` … `document.indexed` / `document.ingestion.failed`
**Depends on:** `intake-pipeline`

**Stages:** intake → preservation → structural extraction → semantic normalization → chunking → enrichment → indexing → activation.

**Canonical models** (`contracts/events.ts`):
```ts
type DocumentIngestionRecord = {
  documentId: string;
  sourceType: 'upload' | 'email_attachment' | 'folder_watch' | 'url' | 'api';
  originalFilename: string; contentHash: string; mimeType: 'application/pdf';
  storageUri: string;
  status: 'uploaded' | 'extracting' | 'chunking' | 'embedding' | 'indexed' | 'failed';
  createdAt: string; completedAt?: string;
};
type DocumentChunk = {
  chunkId: string; documentId: string; pageStart: number; pageEnd: number;
  text: string; tokenCount: number; embeddingId?: string;
  sourceBoundingBoxes?: Array<{ page: number; x: number; y: number; width: number; height: number }>;
};
```

**Boundary rule:** this capability *produces* chunks. It does not own retrieval —
that is `knowledge-index`. Keep them separable so chunks can feed search, maps, or workflows.
