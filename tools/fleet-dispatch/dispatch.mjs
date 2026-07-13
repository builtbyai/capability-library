#!/usr/bin/env node
/**
 * fleet-dispatch — race the 3-host fleet (node-a local, node-b 10.0.0.2,
 * node-c 192.168.1.71) for an Ollama task. First successful response wins.
 *
 * In-library twin of ~/.claude/tools/fleet-ollama.mjs, simpler. Useful when
 * code in the library wants to dispatch a one-off inference without bringing
 * in a full ModelInvocation adapter.
 *
 * Run:
 *   node tools/fleet-dispatch/dispatch.mjs --prompt-file prompt.txt --model qwen2.5-coder:7b --out result.txt
 */
import { readFile, writeFile } from 'node:fs/promises';

const DEFAULTS = {
  hosts: [
    { name: 'node-a', url: 'http://127.0.0.1:11434' },
    { name: 'node-b',    url: 'http://10.0.0.2:11434' },
    { name: 'node-c',    url: 'http://192.168.1.71:11434' },
  ],
  model: 'qwen2.5-coder:7b',
  num_ctx: 32768,
};

const args = process.argv.slice(2);
const opts = { ...DEFAULTS };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--prompt-file') opts.promptFile = args[++i];
  else if (a === '--prompt') opts.prompt = args[++i];
  else if (a === '--model') opts.model = args[++i];
  else if (a === '--out') opts.out = args[++i];
  else if (a === '--num-ctx') opts.num_ctx = Number(args[++i]);
  else if (a === '--hosts-only') opts.hosts = opts.hosts.filter((h) => args[++i].split(',').includes(h.name));
}

if (!opts.prompt && !opts.promptFile) {
  console.error('usage: --prompt-file <path> | --prompt <text> [--model M] [--out PATH] [--num-ctx N] [--hosts-only node-a,node-b]');
  process.exit(2);
}

const prompt = opts.prompt ?? (await readFile(opts.promptFile, 'utf8'));
if (prompt.length > 300 && !opts.promptFile) {
  console.error('[fleet-dispatch] warning: long inline --prompt; prefer --prompt-file to keep shell quoting sane.');
}

async function tryHost(host) {
  const t0 = Date.now();
  const res = await fetch(`${host.url}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: opts.model, prompt, stream: false, options: { num_ctx: opts.num_ctx } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { host: host.name, wallMs: Date.now() - t0, text: data.response };
}

const results = await Promise.allSettled(opts.hosts.map(tryHost));
const winners = results
  .map((r, i) => ({ r, host: opts.hosts[i].name }))
  .filter((x) => x.r.status === 'fulfilled')
  .sort((a, b) => a.r.value.wallMs - b.r.value.wallMs);

if (winners.length === 0) {
  console.error('all hosts failed:');
  results.forEach((r, i) => console.error(`  ${opts.hosts[i].name}: ${r.reason?.message ?? r.reason}`));
  process.exit(1);
}

const winner = winners[0].r.value;
console.error(`[winner: ${winner.host} ${winner.wallMs}ms]`);
if (opts.out) {
  await writeFile(opts.out, winner.text, 'utf8');
  console.error(`[wrote ${opts.out}]`);
} else {
  console.log(winner.text);
}
