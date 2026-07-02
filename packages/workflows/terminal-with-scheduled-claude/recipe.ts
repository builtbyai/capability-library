/** terminal-with-scheduled-claude -- scheduler triggers local-agent-terminal:runProfile.
 *  Sets keepAlive=true so the idle reaper does not kill the session mid-run. */
import { jobs } from '@multimarcdown/core';

export interface ScheduledTerminalConfig {
  profileId: 'claude-yolo' | 'claude-safe' | 'powershell' | 'bash' | 'npm-dev' | 'test-runner';
  cwd: string;
  cron: string;
}

export async function schedule(cfg: ScheduledTerminalConfig): Promise<{ jobId: string }> {
  return jobs.enqueue('scheduler', 'registerCron', {
    name: `local-agent-terminal:runProfile:${cfg.profileId}`,
    cron: cfg.cron,
    capabilityId: 'local-agent-terminal',
    handler: 'runProfile',
    input: { profileId: cfg.profileId, cwd: cfg.cwd, keepAlive: true },
  }) as Promise<{ jobId: string }>;
}
