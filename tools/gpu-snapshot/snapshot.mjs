#!/usr/bin/env node
/**
 * gpu-snapshot — collect GPU / VRAM telemetry from each fleet host.
 * Hits the local nvidia-smi / rocm-smi where available; for remote hosts,
 * shells out via ssh (uses ~/.ssh/known_hosts.<host> per ssh-fleet convention).
 *
 * Run:
 *   node tools/gpu-snapshot/snapshot.mjs            # text
 *   node tools/gpu-snapshot/snapshot.mjs --json     # JSON
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

const JSON_MODE = process.argv.includes('--json');

const HOSTS = [
  { name: 'bbwadmin', local: true,  ssh: null },
  { name: 'jmain',    local: false, ssh: 'Admin@10.10.10.2' },
  { name: 'jmint',    local: false, ssh: 'jalen@192.168.0.71' },
];

async function queryHost(h) {
  // Try nvidia-smi first; if that fails, try rocm-smi.
  const nvFmt = '--query-gpu=index,name,memory.total,memory.used,utilization.gpu,temperature.gpu --format=csv,noheader,nounits';
  const cmds = [`nvidia-smi ${nvFmt}`, `rocm-smi --showuse --json`];
  for (const cmd of cmds) {
    const args = h.local
      ? cmd.split(' ')
      : ['-o', `UserKnownHostsFile=${process.env.HOME}/.ssh/known_hosts.${h.name}`, h.ssh, cmd];
    const bin = h.local ? args[0] : 'ssh';
    const rest = h.local ? args.slice(1) : args;
    try {
      const { stdout } = await exec(bin, rest, { timeout: 4000 });
      return { host: h.name, kind: cmd.startsWith('nvidia') ? 'nvidia' : 'amd', raw: stdout.trim() };
    } catch { /* try next */ }
  }
  return { host: h.name, kind: null, raw: null, error: 'no GPU CLI responded' };
}

function parseNvidia(raw) {
  return raw.split('\n').map((line) => {
    const [index, name, totalMb, usedMb, utilPct, tempC] = line.split(',').map((s) => s.trim());
    return {
      gpuIndex: Number(index),
      model: name,
      vramTotalMb: Number(totalMb),
      vramUsedMb: Number(usedMb),
      utilizationPct: Number(utilPct),
      temperatureC: Number(tempC),
    };
  });
}

const snapshots = [];
for (const h of HOSTS) {
  const result = await queryHost(h);
  if (result.kind === 'nvidia') {
    for (const gpu of parseNvidia(result.raw)) snapshots.push({ host: h.name, vendor: 'nvidia', ...gpu });
  } else if (result.kind === 'amd') {
    // rocm-smi JSON shape varies; surface raw.
    snapshots.push({ host: h.name, vendor: 'amd', raw: result.raw });
  } else {
    snapshots.push({ host: h.name, vendor: null, error: result.error });
  }
}

if (JSON_MODE) {
  console.log(JSON.stringify({ snapshots, collectedAt: new Date().toISOString() }, null, 2));
} else {
  console.log('GPU SNAPSHOT');
  console.log('============');
  for (const s of snapshots) {
    if (s.error) {
      console.log(`[??] ${s.host.padEnd(10)} ${s.error}`);
    } else if (s.vendor === 'nvidia') {
      const pct = ((s.vramUsedMb / s.vramTotalMb) * 100).toFixed(0);
      console.log(`[OK] ${s.host.padEnd(10)} #${s.gpuIndex} ${s.model} ${s.vramUsedMb}/${s.vramTotalMb}MB (${pct}%) util=${s.utilizationPct}% ${s.temperatureC}°C`);
    } else {
      console.log(`[AMD] ${s.host.padEnd(10)} (raw rocm-smi):\n${s.raw}`);
    }
  }
}
