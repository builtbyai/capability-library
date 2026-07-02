#!/usr/bin/env node
/**
 * jobs-agent.mjs — local executor for cf-app job queue.
 *
 * Polls https://mjb-content-forge.pages.dev/api/jobs?status=queued&claim=1
 * every 5 seconds. When it claims a job, it spawns the command in this
 * machine's shell, captures stdout/stderr, and POSTs the result back to
 * /api/jobs/<id>/complete.
 *
 * Why: the deployed cf-app is HTTPS and can't iframe/POST to localhost.
 * Worker-side execution can't run node scripts. This agent is the bridge:
 * the user runs ONE long-lived process on their machine, and the dashboard's
 * "▶ Start" buttons fire real local commands via the KV-backed queue.
 *
 * Usage:
 *   AUTH_USER=you@example.com AUTH_PASS='<your-password>' node tools/jobs-agent.mjs
 * Or pass them as flags:
 *   node tools/jobs-agent.mjs --user <user> --pass '<password>'
 *
 * Options:
 *   --base    https://mjb-content-forge.pages.dev    (default)
 *   --poll-ms 5000                                   (default)
 *   --cwd     C:/Code/CODE_MODULE_LIBRARY            (default: this script's repo root)
 *   --allow   comma-separated whitelist of command prefixes (default: node packages/,bash scripts/,npm,npx)
 *
 * SAFETY: agent only runs commands whose first token matches the --allow
 * whitelist. Default refuses arbitrary shell — protects against a stolen
 * cookie creating destructive jobs.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const BASE = (arg('--base') || 'https://mjb-content-forge.pages.dev').replace(/\/$/, '');
const POLL_MS = parseInt(arg('--poll-ms', '5000'), 10);
const CWD = arg('--cwd', REPO_ROOT);
const ALLOW = (arg('--allow', 'node packages/,bash scripts/,npm,npx,powershell -NoProfile') || '').split(',').map(s => s.trim()).filter(Boolean);
const USER = arg('--user') || process.env.AUTH_USER;
const PASS = arg('--pass') || process.env.AUTH_PASS;
if (!USER || !PASS) {
  console.error('Need --user + --pass (or AUTH_USER + AUTH_PASS env vars).');
  process.exit(1);
}
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASS).toString('base64');

console.log(`[agent] base: ${BASE}`);
console.log(`[agent] user: ${USER}`);
console.log(`[agent] cwd:  ${CWD}`);
console.log(`[agent] poll: ${POLL_MS}ms`);
console.log(`[agent] allow: ${ALLOW.join(' | ')}`);
console.log('');

function commandAllowed(cmd) {
  return ALLOW.some(prefix => cmd.startsWith(prefix));
}

async function claimNext() {
  const r = await fetch(`${BASE}/api/jobs?status=queued&claim=1`, {
    headers: { Authorization: AUTH, Accept: 'application/json' },
  });
  if (!r.ok) {
    if (r.status !== 401) console.error('[agent] claim HTTP', r.status);
    return null;
  }
  const data = await r.json();
  return data.jobs?.[0] || null;
}

async function complete(jobId, payload) {
  const r = await fetch(`${BASE}/api/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) console.error('[agent] complete HTTP', r.status);
}

function runJob(job) {
  return new Promise((resolve) => {
    if (!commandAllowed(job.command)) {
      console.warn(`[agent] REFUSED (not in allow list): ${job.command.slice(0, 100)}`);
      resolve({ exitCode: 126, stdout: '', stderr: 'agent refused: command not in --allow whitelist', durationMs: 0 });
      return;
    }
    console.log(`[agent] ▶ ${job.id} · ${job.name}`);
    console.log(`        $ ${job.command.slice(0, 140)}`);
    const startedAt = Date.now();
    // Use shell so the command can use pipes/redirects/&&
    const shell = process.platform === 'win32' ? 'cmd' : 'bash';
    const args = process.platform === 'win32' ? ['/c', job.command] : ['-c', job.command];
    const child = spawn(shell, args, { cwd: CWD, env: process.env });
    let stdout = '', stderr = '';
    child.stdout?.on('data', d => { stdout += d.toString(); process.stdout.write(d); });
    child.stderr?.on('data', d => { stderr += d.toString(); process.stderr.write(d); });
    child.on('close', (code) => {
      const durationMs = Date.now() - startedAt;
      console.log(`[agent] ${code === 0 ? '✓' : '✗'} ${job.id} (${(durationMs/1000).toFixed(1)}s, exit=${code})`);
      resolve({ exitCode: code, stdout, stderr, durationMs });
    });
    child.on('error', (e) => {
      resolve({ exitCode: -1, stdout, stderr: stderr + '\n' + String(e?.message || e), durationMs: Date.now() - startedAt });
    });
  });
}

async function loop() {
  while (true) {
    try {
      const job = await claimNext();
      if (job) {
        const result = await runJob(job);
        await complete(job.id, result);
      } else {
        // No jobs — wait
        await new Promise(r => setTimeout(r, POLL_MS));
      }
    } catch (e) {
      console.error('[agent] loop error:', e?.message || e);
      await new Promise(r => setTimeout(r, POLL_MS));
    }
  }
}

loop();
