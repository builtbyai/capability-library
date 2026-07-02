/** mega-recovery -- scheduler -> mega-mount watchdog. */
import { jobs } from '@multimarcdown/core';

export async function install(): Promise<{ jobId: string }> {
  return jobs.enqueue('scheduler', 'registerCron', {
    name: 'mega-mount:watchdog',
    cron: '*/15 * * * *',
    capabilityId: 'mega-mount',
    handler: 'watchdog',
    input: {},
  }) as Promise<{ jobId: string }>;
}
