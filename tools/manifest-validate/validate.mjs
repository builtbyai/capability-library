#!/usr/bin/env node
/**
 * manifest-validate — walk every packages/{capabilities,workflows}/<x>/manifest.yaml
 * and check it parses against the zod schema in @multimarcdown/core. Prints a one-line
 * status per manifest and exits non-zero if any fail.
 *
 * Run:   node tools/manifest-validate/validate.mjs
 * Or:    npm run -s validate:manifests  (if you wire it into package.json)
 */
import { readFileSync, globSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let yaml;
try {
  yaml = (await import('js-yaml')).default;
} catch {
  console.error('[manifest-validate] js-yaml not installed. Run `npm install` at the repo root first.');
  process.exit(2);
}

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..', '..');

// Load the schema dynamically — works whether we're pre or post tsc build.
// Falls back to a lenient duck-type check if the compiled module isn't present.
let CapabilityManifestSchema;
try {
  const mod = await import(resolve(ROOT, 'packages/core/dist/manifest.js'));
  CapabilityManifestSchema = mod.CapabilityManifestSchema;
} catch {
  console.warn('[manifest-validate] core/dist not built; using lenient duck-type check.');
  CapabilityManifestSchema = {
    parse(raw) {
      if (!raw || typeof raw !== 'object') throw new Error('not an object');
      for (const k of ['id', 'name', 'kind']) if (!(k in raw)) throw new Error(`missing field: ${k}`);
      return raw;
    },
  };
}

const targets = [
  ...globSync('packages/capabilities/*/manifest.yaml', { cwd: ROOT }),
  ...globSync('packages/workflows/*/manifest.yaml', { cwd: ROOT }),
];

let ok = 0;
let bad = 0;
const failures = [];
for (const rel of targets.sort()) {
  const abs = resolve(ROOT, rel);
  try {
    const raw = yaml.load(readFileSync(abs, 'utf8'));
    CapabilityManifestSchema.parse(raw);
    console.log(`  OK  ${rel}`);
    ok++;
  } catch (e) {
    console.log(`  FAIL ${rel}: ${e.message ?? e}`);
    failures.push({ rel, error: String(e.message ?? e) });
    bad++;
  }
}
console.log(`\n${ok}/${ok + bad} manifests valid${bad ? `, ${bad} failed` : ''}.`);
if (bad > 0) {
  console.error('Failures:');
  for (const f of failures) console.error(`  ${f.rel}: ${f.error}`);
  process.exit(1);
}
