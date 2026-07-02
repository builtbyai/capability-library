#!/usr/bin/env node
/**
 * new-capability — scaffold a new packages/capabilities/<name>/ from the
 * templates/capability-template/ tree. Replaces the manual `cp -r` instruction
 * with a real scaffolder that:
 *   - validates the name is kebab-case + unique
 *   - copies templates/capability-template/ → packages/capabilities/<name>/
 *   - renames id placeholders inside manifest.yaml + README.md
 *   - emits a package.json + tsconfig.json matching the conventions in
 *     packages/capabilities/local-agent-terminal/
 *
 * Does NOT touch registry.yaml or generated/ — promotion to the curated
 * catalog is a deliberate manual step (per CLAUDE.md).
 *
 * Run:   node tools/new-capability/scaffold.mjs <kebab-name> "<short description>"
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..', '..');

const [, , rawName, ...descParts] = process.argv;
const name = rawName?.toLowerCase();
const description = descParts.join(' ');

if (!name || !description) {
  console.error('usage: node tools/new-capability/scaffold.mjs <kebab-name> "<short description>"');
  process.exit(2);
}
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(`error: name must be kebab-case (got: ${name})`);
  process.exit(2);
}

const TEMPLATE = resolve(ROOT, 'templates/capability-template');
const TARGET = resolve(ROOT, 'packages/capabilities', name);

if (!existsSync(TEMPLATE)) {
  console.error(`error: template not found at ${TEMPLATE}`);
  process.exit(2);
}
if (existsSync(TARGET)) {
  console.error(`error: ${TARGET} already exists`);
  process.exit(2);
}

// Walk + copy with placeholder substitution.
function rewriteText(text) {
  return text
    .replaceAll('CHANGE-ME', name)
    .replaceAll('CAPABILITY_NAME_PLACEHOLDER', name)
    .replaceAll('CAPABILITY_DESCRIPTION_PLACEHOLDER', description);
}

function walk(srcDir, dstDir) {
  mkdirSync(dstDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const s = join(srcDir, entry);
    const d = join(dstDir, entry);
    const st = statSync(s);
    if (st.isDirectory()) walk(s, d);
    else {
      const txt = readFileSync(s, 'utf8');
      writeFileSync(d, rewriteText(txt), 'utf8');
    }
  }
}

walk(TEMPLATE, TARGET);

// Inject package.json + tsconfig.json if the template doesn't include them.
const pkgPath = join(TARGET, 'package.json');
if (!existsSync(pkgPath)) {
  writeFileSync(pkgPath, JSON.stringify({
    name: `@multimarcdown/${name}`,
    version: '0.1.0',
    type: 'module',
    private: true,
    description,
    scripts: { build: 'tsc -b' },
    dependencies: {
      '@multimarcdown/core': 'workspace:*',
      zod: '^3.23.0',
    },
  }, null, 2) + '\n', 'utf8');
}
const tsPath = join(TARGET, 'tsconfig.json');
if (!existsSync(tsPath)) {
  writeFileSync(tsPath, JSON.stringify({
    extends: '../../../tsconfig.base.json',
    compilerOptions: { outDir: './dist', rootDir: '.', types: ['node'] },
    include: ['contracts/**/*', 'src/**/*'],
    references: [{ path: '../../core' }],
  }, null, 2) + '\n', 'utf8');
}

console.log(`scaffolded ${TARGET}`);
console.log('next:');
console.log(`  1. fill out packages/capabilities/${name}/manifest.yaml`);
console.log(`  2. write contracts/events.ts (zod-validated)`);
console.log(`  3. add a row to registry.yaml under capabilities: (after you have a real manifest)`);
console.log(`  4. flesh out docs/architecture.md, docs/sharp-edges.md, docs/diagnostics.runbook.md`);
