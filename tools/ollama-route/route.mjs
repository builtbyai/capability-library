#!/usr/bin/env node
/**
 * ollama-route — query each fleet Ollama instance, return URL of the least-
 * loaded healthy one. Standalone version of the gpu-router capability's
 * routing step. Use from shell scripts that need a free `OLLAMA_HOST` env.
 *
 * Run:
 *   export OLLAMA_HOST=$(node tools/ollama-route/route.mjs)
 *   node tools/ollama-route/route.mjs --json
 *   node tools/ollama-route/route.mjs --require-model qwen2.5-coder:7b
 */
const HOSTS = [
  { name: 'node-a', url: 'http://127.0.0.1:11434' },
  { name: 'node-b',    url: 'http://10.0.0.2:11434' },
  { name: 'node-c',    url: 'http://192.168.1.71:11434' },
];

const JSON_MODE = process.argv.includes('--json');
const REQUIRE_MODEL_IDX = process.argv.indexOf('--require-model');
const REQUIRE_MODEL = REQUIRE_MODEL_IDX >= 0 ? process.argv[REQUIRE_MODEL_IDX + 1] : null;

async function probe(host) {
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 2500);
    const tags = await fetch(`${host.url}/api/tags`, { signal: ctl.signal });
    if (!tags.ok) return null;
    const data = await tags.json();
    const psRes = await fetch(`${host.url}/api/ps`, { signal: ctl.signal }).catch(() => null);
    const ps = psRes && psRes.ok ? await psRes.json() : { models: [] };
    return {
      ...host,
      rttMs: Date.now() - t0,
      models: data.models?.map((m) => m.name) ?? [],
      inflight: ps.models?.length ?? 0,
      hasRequiredModel: REQUIRE_MODEL ? (data.models?.some((m) => m.name === REQUIRE_MODEL) ?? false) : true,
    };
  } catch {
    return null;
  }
}

const results = (await Promise.all(HOSTS.map(probe))).filter(Boolean);
const eligible = results.filter((r) => r.hasRequiredModel);

if (eligible.length === 0) {
  console.error('no host satisfies the request');
  process.exit(1);
}

// Score: lower inflight + lower RTT wins.
eligible.sort((a, b) => a.inflight - b.inflight || a.rttMs - b.rttMs);
const winner = eligible[0];

if (JSON_MODE) {
  console.log(JSON.stringify({ winner, considered: results }, null, 2));
} else {
  console.log(winner.url);
  console.error(`[ollama-route] ${winner.name} (rtt=${winner.rttMs}ms, inflight=${winner.inflight})`);
}
