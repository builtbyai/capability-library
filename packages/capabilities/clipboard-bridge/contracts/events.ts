/**
 * clipboard-bridge contracts. Pull (snapshot the clipboard into intake) and
 * push (write a string back to the clipboard for paste-into-app workflows).
 */
import { z } from 'zod';

export const ClipboardContentKind = z.enum(['text', 'html', 'image', 'file-list']);
export type ClipboardContentKind = z.infer<typeof ClipboardContentKind>;

export const ClipboardSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  kind: ClipboardContentKind,
  /** sha256 of the canonical bytes (text utf8, image binary, html utf8). */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
  /** A short preview safe to render in the dashboard (first 200 chars or thumb URL). */
  preview: z.string(),
  capturedAt: z.string().datetime(),
  intakeObjectId: z.string().uuid().optional(),
});
export type ClipboardSnapshot = z.infer<typeof ClipboardSnapshotSchema>;

export const ClipboardSnapshotCapturedEvent = z.object({ event: z.literal('clipboard.snapshot.captured'), snapshot: ClipboardSnapshotSchema });
export const ClipboardWriteRequestedEvent  = z.object({ event: z.literal('clipboard.write.requested'), text: z.string(), source: z.string() });
export const ClipboardWriteCompletedEvent  = z.object({ event: z.literal('clipboard.write.completed'), source: z.string(), at: z.string() });

export const EVENT_NAMES = {
  captured: 'clipboard.snapshot.captured',
  writeRequested: 'clipboard.write.requested',
  writeCompleted: 'clipboard.write.completed',
} as const;

export interface ClipboardBridgePort {
  snapshot(): Promise<ClipboardSnapshot>;
  history(opts?: { limit?: number; kinds?: ClipboardContentKind[] }): Promise<ClipboardSnapshot[]>;
  write(input: { text: string; source: string }): Promise<void>;
}
