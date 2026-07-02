#!/usr/bin/env node
/**
 * r2-backfill.mjs — uploads every existing generation artifact on disk
 * to R2 mjb-commerce-media under the canonical key scheme.
 *
 * Targets:
 *   mockups/real-trends/generated/<niche>/*.png         -> mjb/products/<niche>/<basename>
 *   mockups/real-trends/generated/logos/*.png            -> mjb/logos/lanes/<basename>
 *   mockups/real-trends/generated/shop-logos/*.png       -> mjb/shops/<basename>
 *   mockups/real-trends/generated/shop-concepts/*.json   -> mjb/shops/concepts/<basename>
 *   mockups/real-trends/research/*.json                  -> mjb/research/<basename>
 *   mockups/*.html                                       -> mjb/views/<basename>
 *
 * Runs uploads in parallel batches of 8. Honors a --dry-run flag.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from './r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const MOCKUPS = path.join(REPO_ROOT, 'mockups');
const DRY = process.argv.includes('--dry-run');
const CONCURRENCY = 8;

function* walkAndMap(dir, prefix) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const local = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walkAndMap(local, `${prefix}/${ent.name}`);
    } else {
      yield { localPath: local, key: `${prefix}/${ent.name}` };
    }
  }
}

const jobs = [];
// Products: organized into per-niche subdirs
const productsDir = path.join(MOCKUPS, 'real-trends', 'generated');
for (const ent of fs.existsSync(productsDir) ? fs.readdirSync(productsDir, { withFileTypes: true }) : []) {
  if (!ent.isDirectory()) continue;
  const sub = path.join(productsDir, ent.name);
  if (ent.name === 'logos') {
    for (const j of walkAndMap(sub, 'mjb/logos/lanes')) jobs.push(j);
  } else if (ent.name === 'shop-logos') {
    for (const j of walkAndMap(sub, 'mjb/shops')) jobs.push(j);
  } else if (ent.name === 'shop-concepts') {
    for (const j of walkAndMap(sub, 'mjb/shops/concepts')) jobs.push(j);
  } else {
    // niche dir
    for (const j of walkAndMap(sub, `mjb/products/${ent.name}`)) jobs.push(j);
  }
}

// Research outputs
const researchDir = path.join(MOCKUPS, 'real-trends', 'research');
for (const j of walkAndMap(researchDir, 'mjb/research')) jobs.push(j);

// Top-level HTML mockups (only .html — skip jpeg screenshots etc.)
for (const ent of fs.readdirSync(MOCKUPS, { withFileTypes: true })) {
  if (ent.isFile() && ent.name.endsWith('.html')) {
    jobs.push({ localPath: path.join(MOCKUPS, ent.name), key: `mjb/views/${ent.name}` });
  }
}

// Shop previews (when present)
const shopPrev = path.join(MOCKUPS, 'shop-previews');
if (fs.existsSync(shopPrev)) {
  for (const j of walkAndMap(shopPrev, 'mjb/views/shop-previews')) jobs.push(j);
}

// Drop the rapidapi raw caches + binary screenshots from the upload set
const skipExt = new Set(['.jpeg', '.amazon.json', '.taobao.json']);
const filtered = jobs.filter(j => {
  const lower = j.key.toLowerCase();
  if (lower.endsWith('.jpeg') || lower.endsWith('.png.map')) return false;
  if (lower.includes('.amazon.json') || lower.includes('.taobao.json')) return false;
  if (lower.includes('mjb/views/') && (lower.endsWith('.jpeg') || lower.endsWith('.png'))) return false;
  return true;
});

console.log(`[backfill] discovered ${jobs.length} candidate files`);
console.log(`[backfill] uploading ${filtered.length} after filter (skipped raw RapidAPI caches + screenshots)`);
if (DRY) {
  console.log('--- DRY RUN ---');
  for (const j of filtered.slice(0, 20)) console.log(`  ${j.key.padEnd(60)} <- ${path.relative(REPO_ROOT, j.localPath)}`);
  if (filtered.length > 20) console.log(`  ... and ${filtered.length - 20} more`);
  process.exit(0);
}
console.log('');

// Concurrency cap
const results = [];
let inFlight = 0, i = 0;
const totalBytes = filtered.reduce((s, j) => s + (fs.statSync(j.localPath).size), 0);
console.log(`[backfill] total payload: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
const startedAt = Date.now();
let uploadedBytes = 0;

await new Promise((done) => {
  const next = () => {
    if (i >= filtered.length && inFlight === 0) return done();
    while (inFlight < CONCURRENCY && i < filtered.length) {
      const job = filtered[i++];
      inFlight++;
      tryPutR2(job.key, job.localPath)
        .then(r => {
          if (r.ok) {
            uploadedBytes += r.bytes;
            const pct = ((i / filtered.length) * 100).toFixed(0);
            console.log(`  [${pct.padStart(3)}%] ${r.key.padEnd(70)} ${(r.bytes/1024).toFixed(0)}KB`);
          } else {
            console.log(`  [FAIL] ${job.key} ${r.error?.slice(0, 80)}`);
          }
          results.push(r);
        })
        .finally(() => { inFlight--; next(); });
    }
  };
  next();
});

const elapsed = (Date.now() - startedAt) / 1000;
const ok = results.filter(r => r.ok).length;
const fail = results.length - ok;
console.log('');
console.log('=== Backfill Summary ===');
console.log(`Uploaded:  ${ok}/${results.length}`);
console.log(`Failed:    ${fail}`);
console.log(`Bytes:     ${(uploadedBytes/1024/1024).toFixed(2)} MB`);
console.log(`Wallclock: ${elapsed.toFixed(1)}s (${(uploadedBytes/1024/elapsed).toFixed(0)} KB/s)`);
console.log(`Manifest:  mockups/real-trends/r2-uploads.json`);
