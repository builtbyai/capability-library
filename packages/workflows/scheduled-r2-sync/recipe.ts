/** scheduled-r2-sync -- Daily incremental sync from a local folder to R2 with quota-aware throttling + notify on failures. */
import { jobs } from '@multimarcdown/core';

export interface ScheduledSyncConfig {
  localPath: string;
  bucket: string;
  prefix: string;
  cron?: string;
}

export async function install(cfg: ScheduledSyncConfig): Promise<{ jobId: string }> {
  return jobs.enqueue('scheduler', 'registerCron', {
    name: `cloud-storage:scheduled-sync:${cfg.bucket}:${cfg.prefix}`,
    cron: cfg.cron ?? '0 2 * * *',
    capabilityId: 'cloud-storage',
    handler: 'scheduled-sync',
    input: { localPath: cfg.localPath, bucket: cfg.bucket, prefix: cfg.prefix },
    retryPolicy: { maxAttempts: 3, backoff: 'exponential', baseMs: 60_000 },
  }) as Promise<{ jobId: string }>;
}
