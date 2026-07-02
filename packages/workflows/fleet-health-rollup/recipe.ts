/** fleet-health-rollup -- scheduler -> fleet-control -> notify. */
import { jobs } from '@multimarcdown/core';

export async function install(): Promise<{ jobId: string }> {
  return jobs.enqueue('scheduler', 'registerCron', {
    name: 'fleet-control:health-rollup',
    cron: '0 * * * *',
    capabilityId: 'fleet-control',
    handler: 'healthRollup',
    input: {},
  }) as Promise<{ jobId: string }>;
}
