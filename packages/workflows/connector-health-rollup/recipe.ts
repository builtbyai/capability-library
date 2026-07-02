/** connector-health-rollup -- hourly cron retests every connector. */
import { jobs } from '@multimarcdown/core';

export async function install(): Promise<{ jobId: string }> {
  return jobs.enqueue('scheduler', 'registerCron', {
    name: 'connector-config:retestHealth',
    cron: '0 * * * *',
    capabilityId: 'connector-config',
    handler: 'retestHealth',
    input: {},
  }) as Promise<{ jobId: string }>;
}
