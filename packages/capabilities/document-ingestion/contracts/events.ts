/**
 * document-ingestion contracts.
 * Owns DocumentRecord/Page/Chunk. knowledge-index consumes Chunk via the
 * ChunkBase hoist in @multimarcdown/core, not by cross-importing this file.
 */
import { z } from 'zod';
import { ContentRefSchema } from '@multimarcdown/core';

export const DocumentStatus = z.enum([
  'uploaded', 'preserving', 'extracting', 'normalizing',
  'chunking', 'enriching', 'indexed', 'failed',
]);
export type DocumentStatus = z.infer<typeof DocumentStatus>;

export const DocumentRecordSchema = z.object({
  documentId: z.string().uuid(),
  intakeObjectId: z.string().uuid(),
  originalFilename: z.string(),
  mimeType: z.string(),
  ref: ContentRefSchema,
  pageCount: z.number().int().nonnegative().optional(),
  status: DocumentStatus,
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).optional(),
});
export type DocumentRecord = z.infer<typeof DocumentRecordSchema>;

export const DocumentPageSchema = z.object({
  documentId: z.string().uuid(),
  pageNumber: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  text: z.string(),
  extractionMethod: z.enum(['pdfjs', 'tesseract-ocr', 'docx-xml', 'markdown-passthrough']),
  ocrConfidence: z.number().min(0).max(1).optional(),
  imageRefs: z.array(ContentRefSchema).optional(),
  tables: z.array(z.object({
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    rows: z.array(z.array(z.string())),
  })).optional(),
});
export type DocumentPage = z.infer<typeof DocumentPageSchema>;

export const DocumentChunkSchema = z.object({
  chunkId: z.string().uuid(),
  documentId: z.string().uuid(),
  intakeObjectId: z.string().uuid(),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  text: z.string(),
  tokenCount: z.number().int().nonnegative(),
  embeddingId: z.string().optional(),
  sourceBoundingBoxes: z.array(z.object({
    page: z.number().int().positive(),
    x: z.number(), y: z.number(),
    width: z.number(), height: z.number(),
  })).optional(),
});
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

export const DocumentIngestionFailedSchema = z.object({
  event: z.literal('document.ingestion.failed'),
  documentId: z.string().uuid(),
  stage: z.enum(['preserve', 'extract', 'ocr', 'normalize', 'chunk', 'enrich', 'index']),
  pageNumber: z.number().int().positive().optional(),
  reason: z.string(),
  retryable: z.boolean(),
});

export const EVENT_NAMES = {
  uploaded: 'document.uploaded',
  preserved: 'document.preserved',
  extractionStarted: 'document.extraction.started',
  pageExtracted: 'document.page.extracted',
  pageFailed: 'document.page.failed',
  tableExtracted: 'document.table.extracted',
  normalized: 'document.normalized',
  chunked: 'document.chunked',
  enriched: 'document.enriched',
  indexed: 'document.indexed',
  ingestionFailed: 'document.ingestion.failed',
} as const;

export interface DocumentIngestionPort {
  ingest(input: { intakeObjectId: string }): Promise<DocumentRecord>;
  getStatus(documentId: string): Promise<DocumentRecord>;
  listPages(documentId: string): Promise<DocumentPage[]>;
  listChunks(documentId: string): Promise<DocumentChunk[]>;
  retryPage(documentId: string, pageNumber: number): Promise<DocumentPage>;
}
