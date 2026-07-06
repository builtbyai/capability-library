/**
 * verify.ts — walk the diagnostic ladder against a running deployment.
 *
 *   node --loader ts-node/esm scripts/verify.ts [--worker https://your-worker.workers.dev]
 *
 * Exits non-zero if the worker reports a rising conflict count or no bridge.
 */

const args = process.argv.slice(2);
const workerArg = args[args.indexOf('--worker') + 1];
const WORKER = workerArg && workerArg.startsWith('http') ? workerArg : process.env.MMD_WORKER_URL;
const DAEMON = `http://127.0.0.1:${process.env.MMD_DAEMON_STATUS_PORT ?? 5181}`;
const BACKEND = process.env.MMD_BACKEND_URL ?? 'http://127.0.0.1:5001';

async function probe(label: string, url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const body = await r.json().catch(() => ({}));
    console.log(`✓ ${label}: HTTP ${r.status}`, JSON.stringify(body));
    return body;
  } catch (err) {
    console.log(`✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main(): Promise<void> {
  console.log('— rung 1: bridge daemon —');
  const daemon = await probe('daemon /status', `${DAEMON}/status`);

  console.log('\n— rung 2: backend inline bridge —');
  await probe('backend bridge-status', `${BACKEND}/api/pty/bridge-status`);

  console.log('\n— rung 3: worker durable object —');
  if (!WORKER) {
    console.log('· skipped (pass --worker or set MMD_WORKER_URL)');
  } else {
    const status = await probe('worker /v1/pty/status', `${WORKER}/v1/pty/status`);
    if (status && status.bridgeConflicts > 0) {
      console.error(`\n⚠ bridgeConflicts=${status.bridgeConflicts} — two bridges may be fighting. See sharp-edges.md.`);
      process.exit(1);
    }
    if (status && !status.bridgeConnected && !(daemon && daemon.wsReadyState === 1)) {
      console.error('\n⚠ no bridge connected anywhere — start the daemon on the host machine.');
      process.exit(1);
    }
  }
  console.log('\nverify complete.');
}

void main();
