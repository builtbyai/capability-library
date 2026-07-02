/**
 * verify.ts — walk windows-control's diagnostic ladder against a running deployment.
 *
 * Reads diagnostics.healthChecks[] from manifest.yaml and runs each in order.
 * Exits 0 if all pass, non-zero on the first failure. Run:
 *   node --loader ts-node/esm scripts/verify.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = resolve(HERE, '..', 'manifest.yaml');

interface HealthCheck { name: string; probe: string; expect?: string }

function extractHealthChecks(yamlText: string): HealthCheck[] {
  const out: HealthCheck[] = [];
  const lines = yamlText.split(/\r?\n/);
  let inHc = false;
  let cur: Partial<HealthCheck> = {};
  for (const line of lines) {
    if (/^\s*healthChecks:\s*$/.test(line)) { inHc = true; continue; }
    if (!inHc) continue;
    if (/^\S/.test(line)) break;
    const trimmed = line.trim();
    if (trimmed.startsWith('- name:')) {
      if (cur.name) out.push(cur as HealthCheck);
      cur = { name: trimmed.replace('- name:', '').trim() };
    } else if (trimmed.startsWith('probe:')) {
      cur.probe = trimmed.replace('probe:', '').trim().replace(/^"|"$/g, '');
    } else if (trimmed.startsWith('expect:')) {
      cur.expect = trimmed.replace('expect:', '').trim().replace(/^"|"$/g, '');
    }
  }
  if (cur.name) out.push(cur as HealthCheck);
  return out;
}

async function runProbe(check: HealthCheck): Promise<{ ok: boolean; detail: string }> {
  const httpMatch = check.probe.match(/https?:\/\/\S+/);
  if (httpMatch) {
    try {
      const res = await fetch(httpMatch[0], { signal: AbortSignal.timeout(5_000) });
      return { ok: res.ok, detail: `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }
  return { ok: false, detail: `probe not auto-runnable; implement here: ${check.probe}` };
}

async function main(): Promise<void> {
  const checks = extractHealthChecks(readFileSync(MANIFEST, 'utf8'));
  if (checks.length === 0) {
    console.error('verify: no healthChecks declared in manifest.yaml');
    process.exit(2);
  }
  console.log(`Running ${checks.length} diagnostic rungs against deployment...\n`);
  for (const [i, check] of checks.entries()) {
    process.stdout.write(`Rung ${i + 1} (${check.name})... `);
    const r = await runProbe(check);
    if (r.ok) { console.log(`OK  ${r.detail}`); }
    else {
      console.log(`FAIL ${r.detail}`);
      console.error(`\nExpected: ${check.expect ?? '(not specified)'}`);
      console.error(`Failed at: ${check.probe}`);
      process.exit(1);
    }
  }
  console.log('\nAll rungs passed.');
}

main().catch((e) => { console.error('verify: unexpected error:', e); process.exit(3); });
