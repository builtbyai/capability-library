/**
 * @multimarcdown/adapter-local-filesystem — local FS implementation of the intake/storage port.
 *
 * Read/list/write against the host filesystem for intake-pipeline (folder watch,
 * file ingest) and ai-file-renamer. Real ops use node:fs/promises; this typed
 * surface keeps callers provider-agnostic (swap for R2/S3 without touching them).
 */
export interface FileEntry {
  path: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
}

export interface LocalFilesystemAdapter {
  list(dir: string): Promise<FileEntry[]>;
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array): Promise<void>;
  move(from: string, to: string): Promise<void>;
}

export function createLocalFilesystemAdapter(): LocalFilesystemAdapter {
  throw new Error('adapter-local-filesystem: not implemented — bind node:fs/promises here');
}
