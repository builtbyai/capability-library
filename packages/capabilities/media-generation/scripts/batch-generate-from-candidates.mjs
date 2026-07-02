#!/usr/bin/env node
/**
 * batch-generate-from-candidates.mjs — auto-generates photorealistic media
 * for every ProductCandidate in mockups/real-trends/candidates.json.
 *
 * Prompts are auto-composed from each candidate's name/description into 3
 * variants: hero (clean studio), lifestyle (in-use), before-after (viral
 * split-screen). Picks top N per niche by a simple priority order:
 *   best-seller > amazon-choice > highest rating (with min 100 reviews).
 *
 * Concurrency: 5 parallel predictions at a time. Each prediction is
 * black-forest-labs/flux-1.1-pro-ultra @ ~$0.06.
 *
 * Outputs:
 *   mockups/real-trends/generated/<niche>/<product-slug>-{hero,lifestyle,before-after}.png
 *   mockups/real-trends/generated/index.json (registry — appended)
 *   mockups/real-trends/generated/batch-summary.json
 *
 * Args:
 *   --top N           per-niche cap (default 2)
 *   --kinds h,l,b     comma list (default hero,lifestyle,before-after)
 *   --niche <id>      restrict to a single niche
 *   --concurrency N   parallel predictions (default 5)
 *   --dry-run         print prompts and cost estimate, don't generate
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const OUT_DIR = path.join(DATA_DIR, 'generated');
const REGISTRY_PATH = path.join(OUT_DIR, 'index.json');

function loadToken() {
  const t = (process.env.REPLICATE_API_TOKEN || '').trim();
  if (t.startsWith('r8_')) return t;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'replicate.token');
  if (fs.existsSync(p)) {
    const v = fs.readFileSync(p, 'utf8').trim();
    if (v.startsWith('r8_')) return v;
  }
  throw new Error('REPLICATE_API_TOKEN not found');
}

const TOKEN = loadToken();
const MODEL = 'black-forest-labs/flux-1.1-pro-ultra';
const COST_PER_IMAGE_USD = 0.06;

// ---- args ----
const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}
function flag(name) { return args.includes(name); }
const TOP_N = parseInt(arg('--top', '2'), 10);
const KINDS = (arg('--kinds', 'hero,lifestyle,before-after') || '').split(',').map(s => s.trim()).filter(Boolean);
const ONLY_NICHE = arg('--niche', null);
const CONCURRENCY = parseInt(arg('--concurrency', '5'), 10);
const DRY = flag('--dry-run');

// ---- load candidates ----
const candidates = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'candidates.json'), 'utf8'));

const byNiche = {};
for (const c of candidates) (byNiche[c._nicheId] ||= []).push(c);

// rank within each niche
const candidateScore = (c) =>
  (c.competitiveContext?.isBestSeller ? 1000 : 0) +
  (c.competitiveContext?.isAmazonChoice ? 500 : 0) +
  (c.reviewSummary?.avgRating ?? 0) * 50 +
  Math.min(c.reviewSummary?.count ?? 0, 100000) * 0.001;

const selected = [];
for (const [nicheId, items] of Object.entries(byNiche)) {
  if (ONLY_NICHE && nicheId !== ONLY_NICHE) continue;
  const ranked = [...items]
    .filter(c => (c.reviewSummary?.count ?? 0) >= 100) // must have minimum social proof
    .sort((a, b) => candidateScore(b) - candidateScore(a))
    .slice(0, TOP_N);
  for (const c of ranked) selected.push(c);
}

console.log(`[batch] selected ${selected.length} candidates (${TOP_N} per niche${ONLY_NICHE ? `, restricted to ${ONLY_NICHE}` : ''})`);
console.log(`[batch] kinds: ${KINDS.join(', ')} (${KINDS.length}/candidate)`);
console.log(`[batch] total predictions: ${selected.length * KINDS.length}`);
console.log(`[batch] estimated cost: $${(selected.length * KINDS.length * COST_PER_IMAGE_USD).toFixed(2)}`);
console.log(`[batch] concurrency: ${CONCURRENCY}`);
console.log('');

// ---- prompt composer ----
function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function shortName(cand) {
  const n = cand.name || '';
  // Drop trailing brand junk / variants for a cleaner phrase
  return n.split(',')[0].split('(')[0].split('-')[0].trim().slice(0, 80);
}

function category(cand) {
  // crude — niche id is already a good category hint
  return cand._nicheId.replace(/-/g, ' ');
}

function composePrompts(cand) {
  const name = shortName(cand);
  const cat = category(cand);
  return {
    hero: `Professional e-commerce product photography of a ${name}, photographed centered on pure white seamless background, subtle soft shadow underneath, 30-degree elevated front angle, sharp studio focus, crisp commercial product photo, Amazon main listing style, no text, no watermark, no logos`,
    lifestyle: `Lifestyle photography of a ${name} in real-world use, ${cat} context, organized clean modern home environment, warm natural daylight, top-down or 3/4 angle, no people visible, no text overlay, Pinterest-style real home photography`,
    'before-after': `Vertical split-screen viral comparison thumbnail: left half shows a chaotic disorganized scene without a ${name}, right half shows the same scene transformed and organized using the ${name}, dramatic before-after transformation, high contrast lighting, eye-catching social media composition, faint vertical divider line down the middle, no text overlay`
  };
}

// ---- generator ----
async function generateOne(cand, kind, prompt, attempt = 1) {
  const slug = slugify(shortName(cand));
  const subdir = path.join(OUT_DIR, cand._nicheId);
  fs.mkdirSync(subdir, { recursive: true });
  const filename = `${slug}-${kind}.png`;
  const filepath = path.join(subdir, filename);
  const startedAt = Date.now();

  const submitRes = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=60',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: '9:16',
        output_format: 'png',
        safety_tolerance: 2,
        raw: false,
      },
    }),
  });

  if (!submitRes.ok) {
    const txt = await submitRes.text();
    if (submitRes.status === 429 && attempt < 4) {
      console.log(`  [rate-limit] ${cand._nicheId}/${slug}-${kind} retry in 8s...`);
      await new Promise(r => setTimeout(r, 8000));
      return generateOne(cand, kind, prompt, attempt + 1);
    }
    throw new Error(`HTTP ${submitRes.status} ${txt.slice(0, 200)}`);
  }

  let pred = await submitRes.json();
  while (pred.status === 'starting' || pred.status === 'processing') {
    await new Promise(r => setTimeout(r, 2500));
    const pr = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } });
    pred = await pr.json();
  }

  if (pred.status !== 'succeeded') {
    throw new Error(`prediction ${pred.status}: ${JSON.stringify(pred.error).slice(0, 150)}`);
  }
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!url) throw new Error('no output url');
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`download HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(filepath, buf);
  // Auto-publish to R2 (non-fatal on failure)
  const r2Key = `mjb/products/${cand._nicheId}/${filename}`;
  const upload = await tryPutR2(r2Key, filepath);
  return {
    candidateId: cand.id,
    nicheId: cand._nicheId,
    slug,
    kind,
    file: path.relative(REPO_ROOT, filepath).replace(/\\/g, '/'),
    bytes: buf.length,
    elapsedMs: Date.now() - startedAt,
    predictionId: pred.id,
    costUsdEstimated: COST_PER_IMAGE_USD,
    r2Key: upload.ok ? upload.key : null,
    r2Url: upload.ok ? upload.publicUrl : null,
    r2Error: upload.ok ? null : upload.error,
  };
}

// ---- build job list (skip already-generated unless --regen) ----
const REGEN = flag('--regen');
let existing = {};
if (fs.existsSync(REGISTRY_PATH)) {
  try { existing = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch {}
}
function alreadyDone(candidateId, kind) {
  if (REGEN) return false;
  const entry = existing[candidateId];
  if (!entry) return false;
  const asset = entry.assets?.find(a => a.kind === kind);
  if (!asset) return false;
  // Confirm the file is still on disk
  const fullPath = path.join(REPO_ROOT, asset.file);
  return fs.existsSync(fullPath);
}
const jobs = [];
let skipped = 0;
for (const cand of selected) {
  const prompts = composePrompts(cand);
  for (const kind of KINDS) {
    if (alreadyDone(cand.id, kind)) { skipped++; continue; }
    jobs.push({ cand, kind, prompt: prompts[kind] });
  }
}
if (skipped > 0) console.log(`[batch] skipped ${skipped} jobs already in registry (use --regen to force)`);

if (DRY) {
  console.log('[DRY RUN] First 6 jobs:');
  for (const j of jobs.slice(0, 6)) {
    console.log(`  ${j.cand._nicheId}/${shortName(j.cand).slice(0,40)} :: ${j.kind}`);
    console.log(`    "${j.prompt.slice(0, 120)}..."`);
  }
  console.log(`...and ${jobs.length - 6} more.`);
  process.exit(0);
}

// ---- run with concurrency cap ----
fs.mkdirSync(OUT_DIR, { recursive: true });
const results = [];
const failures = [];
let inFlight = 0;
let i = 0;
const startedAt = Date.now();

await new Promise((resolveAll) => {
  const next = () => {
    if (i >= jobs.length && inFlight === 0) return resolveAll();
    while (inFlight < CONCURRENCY && i < jobs.length) {
      const job = jobs[i++];
      inFlight++;
      generateOne(job.cand, job.kind, job.prompt)
        .then(r => {
          results.push(r);
          const sn = shortName(job.cand).slice(0, 30);
          console.log(`  [OK]   ${job.cand._nicheId}/${sn.padEnd(32)} ${job.kind.padEnd(13)} ${(r.bytes/1024).toFixed(0)}KB ${r.elapsedMs}ms`);
        })
        .catch(e => {
          failures.push({ cand: job.cand.id, kind: job.kind, niche: job.cand._nicheId, error: String(e?.message ?? e) });
          const sn = shortName(job.cand).slice(0, 30);
          console.log(`  [FAIL] ${job.cand._nicheId}/${sn.padEnd(32)} ${job.kind.padEnd(13)} ${String(e?.message ?? e).slice(0, 80)}`);
        })
        .finally(() => {
          inFlight--;
          next();
        });
    }
  };
  next();
});

const totalElapsedMs = Date.now() - startedAt;

// ---- update registry ----
let registry = {};
if (fs.existsSync(REGISTRY_PATH)) {
  try { registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch {}
}
for (const r of results) {
  registry[r.candidateId] ||= { candidateId: r.candidateId, nicheId: r.nicheId, slug: r.slug, assets: [] };
  // dedupe by kind
  registry[r.candidateId].assets = registry[r.candidateId].assets.filter(a => a.kind !== r.kind);
  registry[r.candidateId].assets.push({ kind: r.kind, file: r.file, bytes: r.bytes, elapsedMs: r.elapsedMs, costUsdEstimated: r.costUsdEstimated, predictionId: r.predictionId, generatedAt: new Date().toISOString() });
}
fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

const summaryPath = path.join(OUT_DIR, 'batch-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify({
  finishedAt: new Date().toISOString(),
  totalJobs: jobs.length,
  succeeded: results.length,
  failed: failures.length,
  totalElapsedMs,
  totalCostUsdEstimated: results.length * COST_PER_IMAGE_USD,
  failures,
}, null, 2));

console.log('');
console.log('=== Summary ===');
console.log(`Succeeded: ${results.length}/${jobs.length}`);
console.log(`Failed:    ${failures.length}`);
console.log(`Wallclock: ${(totalElapsedMs/1000).toFixed(1)}s`);
console.log(`Cost (est): $${(results.length * COST_PER_IMAGE_USD).toFixed(2)}`);
console.log(`Registry:  ${REGISTRY_PATH}`);
console.log(`Summary:   ${summaryPath}`);
