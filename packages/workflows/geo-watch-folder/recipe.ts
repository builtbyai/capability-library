/** geo-watch-folder -- scheduler-driven KML URL refresh per layer. */
import { jobs } from '@multimarcdown/core';

export interface GeoWatchConfig { layerId: string; sourceUrl: string; cron: string }

export async function registerWatch(cfg: GeoWatchConfig): Promise<{ jobId: string }> {
  return jobs.enqueue('scheduler', 'registerCron', {
    name: `geo-visualization:refreshKml:${cfg.layerId}`,
    cron: cfg.cron,
    capabilityId: 'geo-visualization',
    handler: 'refreshKml',
    input: { layerId: cfg.layerId, sourceUrl: cfg.sourceUrl },
  }) as Promise<{ jobId: string }>;
}
