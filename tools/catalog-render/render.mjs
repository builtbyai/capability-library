#!/usr/bin/env node
/**
 * catalog-render — regenerate cross-capability index files from manifests.
 * Replaces the hand-maintained DIRECTORY_INDEX.md / jobs-and-events-catalog.md
 * with an idempotent build step.
 *
 * Outputs:
 *   - knowledge/specs/jobs-and-events-catalog.md
 *   - knowledge/specs/api-and-ui-catalog.md
 *   - (Optional) DIRECTORY_INDEX.md if --top is passed
 *
 * Run:   node tools/catalog-render/render.mjs
 *        node tools/catalog-render/render.mjs --top
 */
import { readFileSync, writeFileSync, globSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

let yaml;
try {
  yaml = (await import('js-yaml')).default;
} catch {
  console.error('[catalog-render] js-yaml not installed. Run `npm install` at the repo root first.');
  process.exit(2);
}

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..', '..');
const TOP = process.argv.includes('--top');

const today = new Date().toISOString().slice(0, 10);

const capabilities = globSync('packages/capabilities/*/manifest.yaml', { cwd: ROOT })
  .sort()
  .map((rel) => {
    const abs = resolve(ROOT, rel);
    const raw = yaml.load(readFileSync(abs, 'utf8'));
    return { rel, dir: basename(dirname(rel)), manifest: raw };
  });

const events = [];
const jobs = [];
const apis = [];
const uis = [];

for (const { manifest, dir } of capabilities) {
  const p = manifest.provides ?? {};
  for (const e of p.events ?? []) events.push({ name: e, cap: dir });
  for (const j of p.jobs ?? []) jobs.push({ name: j, cap: dir });
  for (const a of p.api ?? []) apis.push({ endpoint: a, cap: dir });
  for (const u of p.ui ?? []) uis.push({ component: u, cap: dir });
}

function table(rows, headers) {
  const lines = [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`];
  for (const r of rows) lines.push(`| ${headers.map((h) => `\`${r[h]}\``).join(' | ')} |`);
  return lines.join('\n');
}

const jobsAndEvents = `# Jobs & Events Catalog

> Auto-derived from \`packages/capabilities/*/manifest.yaml\` by \`tools/catalog-render/render.mjs\` on ${today}. Hand-edit and you will lose changes on the next regen.

This file is the cross-capability surface index. Subscribe by event name; dispatch by job name.

**Totals:** ${events.length} events · ${jobs.length} jobs · ${apis.length} HTTP endpoints · ${uis.length} UI components across ${capabilities.length} capabilities.

## Events emitted

${table(events.map(({ name, cap }) => ({ Event: name, 'Emitted by': cap })), ['Event', 'Emitted by'])}

## Jobs declared

${table(jobs.map(({ name, cap }) => ({ Job: name, 'Owner capability': cap })), ['Job', 'Owner capability'])}

## Cross-cluster handoffs

These events cross capability boundaries (subscribed by capabilities other than the emitter):

- \`intake.object.routed\` → document-ingestion, media-processing, geo-visualization, knowledge-index
- \`intake.object.stored\` → any consumer that needs to read bytes (must NOT subscribe to \`received\`)
- \`document.chunk.created\` → knowledge-index
- \`email.attachment.detected\` → intake-pipeline (via gmail-to-rag workflow)
- \`bulk-import.file.uploaded\` → rooflink-backfill-to-rag workflow
- \`cost.recorded\` → emitted by CostLedger; consumed by notify (over-threshold rules)
- \`scheduler.job.failed\` → notify; optionally local-agent-terminal for diagnostic deep-links
- \`transcription.completed\` → knowledge-index (via audio-to-rag workflow)
- \`screenshot.normalized\` → document-ingestion (OCR), if MIME-routed
`;

mkdirSync(resolve(ROOT, 'knowledge/specs'), { recursive: true });
writeFileSync(resolve(ROOT, 'knowledge/specs/jobs-and-events-catalog.md'), jobsAndEvents, 'utf8');
console.log(`wrote knowledge/specs/jobs-and-events-catalog.md`);

const apiAndUi = `# API & UI Surface Catalog

> Auto-derived from \`packages/capabilities/*/manifest.yaml\` by \`tools/catalog-render/render.mjs\` on ${today}.

## API endpoints

${table(apis.map(({ endpoint, cap }) => ({ Endpoint: endpoint, Capability: cap })), ['Endpoint', 'Capability'])}

## UI components

${table(uis.map(({ component, cap }) => ({ Component: component, Capability: cap })), ['Component', 'Capability'])}
`;

writeFileSync(resolve(ROOT, 'knowledge/specs/api-and-ui-catalog.md'), apiAndUi, 'utf8');
console.log(`wrote knowledge/specs/api-and-ui-catalog.md`);

if (TOP) {
  console.log('--top flag not implemented yet (DIRECTORY_INDEX is hand-curated for now).');
}

console.log(`indexed ${capabilities.length} capabilities · ${events.length} events · ${jobs.length} jobs · ${apis.length} APIs · ${uis.length} UI surfaces`);
