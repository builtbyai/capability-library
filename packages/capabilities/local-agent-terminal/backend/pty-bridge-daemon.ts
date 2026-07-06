/**
 * pty-bridge-daemon — a standalone process wrapper around pty-bridge.
 *
 * Why it exists: the daemon's whole job is to survive backend restarts. It runs
 * at logon (install-pty-bridge.bat / systemd) and ALWAYS owns the worker's bridge
 * slot. The dashboard backend defers to it (see routes.ts daemon-priority gating).
 *
 * It exposes GET /status on DAEMON_STATUS_PORT — the source of truth for the
 * daemon itself, the first rung of the diagnostic ladder.
 *
 * Run:  node dist/backend/pty-bridge-daemon.js
 * Env:  MMD_CLOUD_WS_BASE, DASHBOARD_AGENT_SECRET, MMD_DAEMON_STATUS_PORT
 */
import http from 'node:http';
import { createLogger } from '@multimarcdown/core';
import { startPtyBridge, stopPtyBridge, getBridgeStatus } from './pty-bridge.js';

const log = createLogger('pty-bridge-daemon');

const CLOUD_WS_BASE = process.env.MMD_CLOUD_WS_BASE || 'wss://your-worker.workers.dev';
const STATUS_PORT = Number(process.env.MMD_DAEMON_STATUS_PORT || 5181);
const AGENT_SECRET_FILE = process.env.MMD_AGENT_SECRET_FILE || 'backend/data/agent-secret.txt';

startPtyBridge({ cloudWsBase: CLOUD_WS_BASE, agentSecretFile: AGENT_SECRET_FILE });

const server = http.createServer((req, res) => {
  if (req.url === '/status') {
    const status = getBridgeStatus();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ...status, role: 'daemon', cloudWsBase: CLOUD_WS_BASE }));
    return;
  }
  res.writeHead(404).end('not found');
});

server.listen(STATUS_PORT, '127.0.0.1', () => {
  log.info('daemon status server listening', { port: STATUS_PORT, cloudWsBase: CLOUD_WS_BASE });
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    log.info('shutting down daemon', { sig });
    stopPtyBridge();
    server.close(() => process.exit(0));
  });
}
