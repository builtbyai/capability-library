/**
 * Backend entrypoint for the local-agent-terminal capability.
 * Re-exports the service + routes and registers health checks / a diagnostic
 * ladder with @multimarcdown/core so the dashboard can roll this up.
 */
import { health, type DiagnosticStep } from '@multimarcdown/core';
import { getBridgeStatus } from './pty-bridge.js';
import { isPtyBridgeDaemonHealthy } from './routes.js';

export * from './pty-service.js';
export * from './pty-bridge.js';
export * from './routes.js';

const CAPABILITY_ID = 'local-agent-terminal';

export function registerHealthChecks(opts: { daemonStatusPort?: number } = {}): void {
  const port = opts.daemonStatusPort ?? 5181;

  health.register(CAPABILITY_ID, 'daemon', async () => {
    const ok = await isPtyBridgeDaemonHealthy(port);
    return ok
      ? { state: 'healthy', detail: 'daemon /status reports wsReadyState=1' }
      : { state: 'degraded', detail: 'daemon not connected (inline bridge may be active)' };
  });

  health.register(CAPABILITY_ID, 'inline-bridge', async () => {
    const s = getBridgeStatus();
    if (s.status === 'claimed') return { state: 'healthy', detail: 'inline bridge claimed slot' };
    if (s.status === 'no-secret') return { state: 'failed', detail: 'AGENT_SECRET missing' };
    if (s.status === 'rejected') return { state: 'degraded', detail: 'slot held elsewhere / backing off' };
    return { state: 'unknown', detail: `status=${s.status}` };
  });
}

/** The triage ladder, lifted from the original guide's diagnostic surface. */
export const diagnosticLadder: DiagnosticStep[] = [
  {
    probe: 'curl http://127.0.0.1:5181/status',
    expect: 'status: "claimed", wsReadyState: 1',
    onFail:
      'If "no-secret": set DASHBOARD_AGENT_SECRET or write backend/data/agent-secret.txt. ' +
      'If "rejected": another bridge holds the slot — find it (tasklist | findstr node) and kill it.',
  },
  {
    probe: 'curl http://127.0.0.1:5001/api/pty/bridge-status',
    expect: 'inline bridge healthy when the daemon is down',
    onFail: 'If the daemon is down and this is also down, the backend never started its inline bridge.',
  },
  {
    probe: 'curl https://<worker>/v1/pty/status',
    expect: 'bridgeConnected: true, bridgeConflicts: 0 (must stay flat)',
    onFail:
      'bridgeConflicts rising = stuck-holder / two bridges fighting. Kill all node procs, restart the daemon. ' +
      'lastDisconnect.host != your machine = some other host held the slot.',
  },
];
