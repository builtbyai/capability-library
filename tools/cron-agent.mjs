#!/usr/bin/env node
/**
 * cron-agent.mjs — long-lived process that auto-queues recurring jobs.
 *
 * The deployed cf-app's job queue is great for on-demand work, but
 * continuous trend pulls / refresh tasks need someone to actually
 * fire them on schedule. This is that someone.
 *
 * Run alongside jobs-agent.mjs:
 *   node tools/jobs-agent.mjs  --user <user> --pass '<password>'   # executes
 *   node tools/cron-agent.mjs  --user <user> --pass '<password>'   # schedules
 *
 * Built-in recurring jobs (see SCHEDULE constant):
 *   trends-pull        every 6h    pull-trends.mjs    (RapidAPI free)
 *   research-refresh   every 24h   research-with-gemini.mjs  (~$0.01)
 *   redeploy           every 24h   bash scripts/deploy-cf-pages.sh
 *
 * Override the cadence with --schedule '<jobName>:<minutes>,<other>:<m>'
 * Add ad-hoc jobs to /api/jobs from any client; this script only manages
 * the recurring ones.
 *
 * Behavior:
 *   - On startup: queues all recurring jobs once (so first run happens fast)
 *   - Then loops: re-queues each job after its cadence elapses
 *   - Skips queueing if the same-name job is already queued OR running
 *     (no double-fires while the agent is mid-execution)
 *   - Sleeps in 60s ticks; checks each job's last-queued time
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const BASE = (arg('--base') || 'https://mjb-content-forge.pages.dev').replace(/\/$/, '');
const USER = arg('--user') || process.env.AUTH_USER;
const PASS = arg('--pass') || process.env.AUTH_PASS;
if (!USER || !PASS) {
  console.error('Need --user + --pass (or AUTH_USER + AUTH_PASS env vars).');
  process.exit(1);
}
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASS).toString('base64');

// Default cadence in MINUTES
const DEFAULT_SCHEDULE = {
  'trends-pull':      6 * 60,   // 6h
  'research-refresh': 24 * 60,  // 24h
  'redeploy':         24 * 60,  // 24h
};

const JOB_COMMANDS = {
  'trends-pull':      { name: 'Pull trends (cron)',      command: 'node packages/capabilities/product-intelligence/scripts/pull-trends.mjs' },
  'research-refresh': { name: 'Research refresh (cron)', command: 'node packages/capabilities/product-intelligence/scripts/research-with-gemini.mjs' },
  'redeploy':         { name: 'Redeploy cf-app (cron)',  command: 'bash scripts/deploy-cf-pages.sh' },
};

// Parse --schedule overrides
const SCHEDULE = { ...DEFAULT_SCHEDULE };
const overrides = arg('--schedule', '');
if (overrides) {
  for (const pair of overrides.split(',')) {
    const [k, v] = pair.split(':').map(s => s.trim());
    if (JOB_COMMANDS[k] && Number(v) > 0) SCHEDULE[k] = Number(v);
  }
}

console.log(`[cron] base: ${BASE}`);
console.log(`[cron] user: ${USER}`);
console.log(`[cron] schedule (minutes):`);
for (const [k, m] of Object.entries(SCHEDULE)) {
  console.log(`         ${k.padEnd(20)} every ${m}m  (${(m/60).toFixed(1)}h)`);
}
console.log('');

const lastQueued = {}; // jobName -> Date

async function listJobs() {
  const r = await fetch(`${BASE}/api/jobs`, { headers: { Authorization: AUTH } });
  if (!r.ok) throw new Error('jobs list HTTP ' + r.status);
  return (await r.json()).jobs || [];
}

async function createJob(name, command) {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, command }),
  });
  if (!r.ok) throw new Error('create HTTP ' + r.status);
  return r.json();
}

async function tick() {
  let allJobs = [];
  try { allJobs = await listJobs(); }
  catch (e) { console.error('[cron] list failed:', e.message); return; }

  for (const [scheduleKey, minutes] of Object.entries(SCHEDULE)) {
    const def = JOB_COMMANDS[scheduleKey];
    if (!def) continue;
    // Skip if already queued/running
    const active = allJobs.find(j => j.name === def.name && (j.status === 'queued' || j.status === 'running'));
    if (active) continue;
    // Find last-completed instance of THIS recurring job
    const lastDone = allJobs.find(j => j.name === def.name && (j.status === 'completed' || j.status === 'failed'));
    const lastTime = lastDone ? new Date(lastDone.finishedAt).getTime() : (lastQueued[scheduleKey] || 0);
    const ageMin = (Date.now() - lastTime) / 60000;
    if (lastTime > 0 && ageMin < minutes) {
      // Not yet due
      continue;
    }
    try {
      await createJob(def.name, def.command);
      lastQueued[scheduleKey] = Date.now();
      console.log(`[cron] queued ${scheduleKey} (was ${ageMin.toFixed(0)}m old, cadence ${minutes}m)`);
    } catch (e) {
      console.error(`[cron] failed to queue ${scheduleKey}:`, e.message);
    }
  }
}

// Run once at startup, then every 60s
await tick();
setInterval(tick, 60_000);
console.log('[cron] running — Ctrl+C to stop. Pair with jobs-agent.mjs to actually execute the queued jobs.');
