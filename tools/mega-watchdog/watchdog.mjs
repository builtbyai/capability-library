#!/usr/bin/env node
/**
 * mega-watchdog — periodic health check on the Mega rclone+MEGAcmd->WebDAV
 * mount. Triggers restart on hang detection.
 *
 * Per user memory `mega_mount_hang_pattern.md`: MEGAclient IPC can hang for
 * minutes; whoami calls block silently. We probe the mount with a timeout
 * and force-restart if it doesn't respond.
 *
 * Run:
 *   node tools/mega-watchdog/watchdog.mjs --mount Y: --timeout 30
 *   node tools/mega-watchdog/watchdog.mjs --mount /mnt/mega --restart-cmd "systemctl restart mega-mount"
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { statSync } from 'node:fs';
const exec = promisify(execFile);

const args = process.argv.slice(2);
const opts = { mount: process.platform === 'win32' ? 'Y:' : '/mnt/mega', timeoutSec: 30, dryRun: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--mount') opts.mount = args[++i];
  else if (a === '--timeout') opts.timeoutSec = Number(args[++i]);
  else if (a === '--restart-cmd') opts.restartCmd = args[++i];
  else if (a === '--dry-run') opts.dryRun = true;
}

async function probeMount(path, timeoutSec) {
  // Two checks: (1) stat works (2) list succeeds within timeout.
  try {
    statSync(path);
  } catch (e) {
    return { ok: false, reason: `stat failed: ${e.message}` };
  }
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ok: false, reason: `listing timed out after ${timeoutSec}s` }), timeoutSec * 1000);
    const cmd = process.platform === 'win32' ? 'cmd' : 'ls';
    const arg = process.platform === 'win32' ? ['/c', 'dir', '/b', path] : [path];
    execFile(cmd, arg, (err, stdout, stderr) => {
      clearTimeout(t);
      if (err) resolve({ ok: false, reason: `listing failed: ${err.message}` });
      else resolve({ ok: true, entries: stdout.split('\n').filter(Boolean).length });
    });
  });
}

const t0 = Date.now();
const result = await probeMount(opts.mount, opts.timeoutSec);
const probeMs = Date.now() - t0;

if (result.ok) {
  console.log(`[OK] ${opts.mount} listed in ${probeMs}ms (${result.entries} entries)`);
  process.exit(0);
}

console.error(`[HUNG] ${opts.mount}: ${result.reason} (probe took ${probeMs}ms)`);
if (opts.dryRun) {
  console.error('[DRY] would restart but --dry-run is set');
  process.exit(2);
}

if (opts.restartCmd) {
  console.error(`[RESTARTING] ${opts.restartCmd}`);
  try {
    const [bin, ...rest] = opts.restartCmd.split(' ');
    const { stdout, stderr } = await exec(bin, rest);
    console.error(stdout);
    if (stderr) console.error(stderr);
    console.error('[RESTART OK]');
  } catch (e) {
    console.error(`[RESTART FAILED] ${e.message}`);
    process.exit(3);
  }
}
process.exit(2);
