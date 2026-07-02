/** folder-watch-import -- chokidar watcher -> intake-pipeline. */
import { createLogger } from '@multimarcdown/core';
const log = createLogger('folder-watch-import');

export interface FolderWatchConfig { roots: string[] }

export function start(cfg: FolderWatchConfig): () => Promise<void> {
  log.info('folder-watch start', { roots: cfg.roots });
  // Implementation: chokidar.watch(cfg.roots).on('add', file => jobs.enqueue('intake-pipeline','ingestFile',{path:file}));
  return async () => { log.info('folder-watch stop'); };
}
