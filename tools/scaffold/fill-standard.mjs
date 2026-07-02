/**
 * fill-standard.mjs — bring every capability up to the template's minimum shape.
 *
 * For each packages/capabilities/<cap> that is missing them, this writes:
 *   - backend/index.ts   — a register() that registers a health check with core
 *   - scripts/verify.ts  — the manifest-driven diagnostic-ladder verifier
 * and widens the capability's tsconfig `include` to compile backend/ + scripts/.
 *
 * Idempotent: existing files are never overwritten. Run:
 *   node tools/scaffold/fill-standard.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CAPS = join(ROOT, 'packages', 'capabilities');

/** Pull `id:` out of a manifest.yaml without a YAML dep. Falls back to dir name. */
function manifestId(capDir, fallback) {
  const p = join(capDir, 'manifest.yaml');
  if (!existsSync(p)) return fallback;
  const m = readFileSync(p, 'utf8').match(/^id:\s*(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function backendIndex(id) {
  return `/**
 * ${id} backend entrypoint.
 *
 * Registers this capability's health checks (and job handlers, as they land)
 * with @multimarcdown/core so a host dashboard can roll it up. Call register()
 * once during host startup. Replace the placeholder check with a real probe as
 * the service is implemented.
 */
import { health } from '@multimarcdown/core';

export const CAPABILITY_ID = '${id}';

/** Register health checks + job handlers with the core singletons. */
export function register(): void {
  health.register(CAPABILITY_ID, 'implemented', async () => ({
    state: 'unknown',
    detail: '${id}: no runtime service yet — capability is contracts-first',
  }));
}
`;
}

/** The canonical manifest-driven verifier (mirrors templates/capability-template). */
function verifyScript(id) {
  return `/**
 * verify.ts — walk ${id}'s diagnostic ladder against a running deployment.
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
  const lines = yamlText.split(/\\r?\\n/);
  let inHc = false;
  let cur: Partial<HealthCheck> = {};
  for (const line of lines) {
    if (/^\\s*healthChecks:\\s*$/.test(line)) { inHc = true; continue; }
    if (!inHc) continue;
    if (/^\\S/.test(line)) break;
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
  const httpMatch = check.probe.match(/https?:\\/\\/\\S+/);
  if (httpMatch) {
    try {
      const res = await fetch(httpMatch[0], { signal: AbortSignal.timeout(5_000) });
      return { ok: res.ok, detail: \`HTTP \${res.status}\` };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }
  return { ok: false, detail: \`probe not auto-runnable; implement here: \${check.probe}\` };
}

async function main(): Promise<void> {
  const checks = extractHealthChecks(readFileSync(MANIFEST, 'utf8'));
  if (checks.length === 0) {
    console.error('verify: no healthChecks declared in manifest.yaml');
    process.exit(2);
  }
  console.log(\`Running \${checks.length} diagnostic rungs against deployment...\\n\`);
  for (const [i, check] of checks.entries()) {
    process.stdout.write(\`Rung \${i + 1} (\${check.name})... \`);
    const r = await runProbe(check);
    if (r.ok) { console.log(\`OK  \${r.detail}\`); }
    else {
      console.log(\`FAIL \${r.detail}\`);
      console.error(\`\\nExpected: \${check.expect ?? '(not specified)'}\`);
      console.error(\`Failed at: \${check.probe}\`);
      process.exit(1);
    }
  }
  console.log('\\nAll rungs passed.');
}

main().catch((e) => { console.error('verify: unexpected error:', e); process.exit(3); });
`;
}

/** Ensure the capability tsconfig compiles backend/ + scripts/ alongside contracts/. */
function widenTsconfigInclude(capDir) {
  const p = join(capDir, 'tsconfig.json');
  if (!existsSync(p)) return false;
  let cfg;
  try { cfg = JSON.parse(readFileSync(p, 'utf8')); } catch { return false; }
  const want = ['contracts/**/*', 'backend/**/*', 'scripts/**/*'];
  const have = Array.isArray(cfg.include) ? cfg.include : [];
  const merged = [...new Set([...have, ...want])];
  if (merged.length === have.length && want.every((w) => have.includes(w))) return false;
  cfg.include = merged;
  writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  return true;
}

const summary = { backend: [], verify: [], tsconfig: [] };
for (const name of readdirSync(CAPS)) {
  const capDir = join(CAPS, name);
  const id = manifestId(capDir, name);

  const backendFile = join(capDir, 'backend', 'index.ts');
  if (!existsSync(backendFile)) {
    mkdirSync(dirname(backendFile), { recursive: true });
    writeFileSync(backendFile, backendIndex(id));
    summary.backend.push(name);
  }

  const hasVerify = existsSync(join(capDir, 'scripts', 'verify.ts')) || existsSync(join(capDir, 'scripts', 'verify.mjs'));
  if (!hasVerify) {
    const verifyFile = join(capDir, 'scripts', 'verify.ts');
    mkdirSync(dirname(verifyFile), { recursive: true });
    writeFileSync(verifyFile, verifyScript(id));
    summary.verify.push(name);
  }

  if (widenTsconfigInclude(capDir)) summary.tsconfig.push(name);
}

console.log(`backend/index.ts written: ${summary.backend.length}`);
console.log(`scripts/verify.ts written: ${summary.verify.length}`);
console.log(`tsconfig include widened:  ${summary.tsconfig.length}`);
