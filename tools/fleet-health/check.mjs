#!/usr/bin/env node
/**
 * fleet-health — ping all 3 PCs, check Ollama + port-9900 + SSH, report state.
 * Standalone version of the fleet-control capability's health rollup; usable
 * from the command line without spinning up the cap.
 *
 * Run:
 *   node tools/fleet-health/check.mjs
 *   node tools/fleet-health/check.mjs --json
 */
const HOSTS = [
  { name: 'bbwadmin', addresses: ['127.0.0.1', '10.10.10.2', '192.168.0.232'], gui: 9900, ollama: 11434 },
  { name: 'jmain',    addresses: ['10.10.10.2', '192.168.0.216'],              gui: 9900, ollama: 11434 },
  { name: 'jmint',    addresses: ['192.168.0.71', '192.168.0.70'],             gui: 9900, ollama: 11434 },
];

const JSON_MODE = process.argv.includes('--json');

async function tcpProbe(host, port, timeoutMs = 1500) {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(`http://${host}:${port}/`, { signal: ctl.signal }).catch((e) => ({ ok: false, status: 0, _err: e }));
    clearTimeout(timer);
    return { ok: !!res.ok || res.status > 0, status: res.status ?? 0, rttMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, rttMs: Date.now() - t0, error: String(e?.message ?? e) };
  }
}

async function ollamaProbe(host, port) {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`http://${host}:${port}/api/tags`, { signal: ctl.signal });
    if (!res.ok) return { ok: false, status: res.status, rttMs: Date.now() - t0 };
    const data = await res.json();
    return { ok: true, status: 200, rttMs: Date.now() - t0, models: data.models?.length ?? 0 };
  } catch (e) {
    return { ok: false, status: 0, rttMs: Date.now() - t0, error: String(e?.message ?? e) };
  }
}

const results = [];
for (const h of HOSTS) {
  const row = { host: h.name, gui: null, ollama: null, reachedAddress: null };
  for (const a of h.addresses) {
    const g = await tcpProbe(a, h.gui);
    if (g.ok) { row.gui = g; row.reachedAddress = a; break; }
  }
  for (const a of h.addresses) {
    const o = await ollamaProbe(a, h.ollama);
    if (o.ok) { row.ollama = o; row.reachedAddress = row.reachedAddress ?? a; break; }
  }
  row.healthy = !!(row.gui?.ok || row.ollama?.ok);
  results.push(row);
}

if (JSON_MODE) {
  console.log(JSON.stringify({ fleet: results, checkedAt: new Date().toISOString() }, null, 2));
} else {
  console.log('FLEET HEALTH');
  console.log('============');
  for (const r of results) {
    const g = r.gui?.ok ? `GUI:${r.gui.rttMs}ms` : 'GUI:DOWN';
    const o = r.ollama?.ok ? `OLLAMA:${r.ollama.rttMs}ms(${r.ollama.models} models)` : 'OLLAMA:DOWN';
    const addr = r.reachedAddress ? `via ${r.reachedAddress}` : 'no address responded';
    const flag = r.healthy ? '[OK]  ' : '[DOWN]';
    console.log(`${flag} ${r.host.padEnd(10)} ${g.padEnd(28)} ${o.padEnd(28)} ${addr}`);
  }
  const downCount = results.filter((r) => !r.healthy).length;
  if (downCount > 0) {
    console.log(`\n${downCount}/${results.length} hosts DOWN.`);
    process.exit(1);
  }
}
