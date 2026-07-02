#!/usr/bin/env node
/**
 * generate-logos.mjs — generates 2 logo concept variants per brand lane via
 * Replicate flux-1.1-pro-ultra. Output: 3 lanes × 2 concepts × 1 image = 6
 * logos (~$0.36).
 *
 * Concept #1: distinctive mark (initial-driven, geometric/typographic)
 * Concept #2: full wordmark (typeset, editorial)
 *
 * Outputs to mockups/real-trends/generated/logos/<lane>-concept-{1,2}.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends', 'generated', 'logos');
const REGISTRY = path.join(OUT_DIR, 'index.json');

const TOKEN = (process.env.REPLICATE_API_TOKEN || fs.readFileSync(path.join(os.homedir(), '.claude', 'secrets', 'replicate.token'), 'utf8')).trim();
const MODEL = 'black-forest-labs/flux-1.1-pro-ultra';

const brandLanes = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'config', 'mjb', 'brand-lanes.json'), 'utf8'));

const PROMPTS = {
  'mjb-home-finds': {
    initial: 'Professional logo mark for "MJB Home Finds" — a single uppercase letter H rendered as a custom serif glyph carved into a rounded warm terracotta clay tile, soft beige cream background, subtle paper texture, editorial brand identity, vector-clean shape, photographed against a creamy off-white surface, no text, no other letters, square composition centered, minimalist warmth, Pinterest-worthy home brand aesthetic',
    wordmark: 'Editorial wordmark logo design for "MJB HOME FINDS" — set in elegant Newsreader-style serif lowercase letters in warm dark brown, photographed on cream paper background with subtle texture, a small terracotta orange dot accent between the two words, generous letterspacing, modern editorial publication brand mark, minimalist, no other graphics or imagery, horizontal composition',
  },
  'mjb-tech-finds': {
    initial: 'Professional logo mark for "MJB Tech Finds" — a single uppercase letter T rendered as a clean geometric sans-serif glyph, charcoal black, embossed into matte white surface with subtle shadow, minimalist tech brand identity, vector-precise edges, square composition centered, no text other than the single letter T, no other graphics, modern apple-store aesthetic, premium feel',
    wordmark: 'Modern wordmark logo for "MJB TECH FINDS" — set in clean geometric sans-serif uppercase letters in deep charcoal, horizontal alignment with a small violet square accent between MJB and TECH FINDS, photographed on pure white background, no other graphics, minimalist premium tech brand identity',
  },
  'mjb-everyday-utility': {
    initial: 'Professional logo mark for "MJB Everyday Utility" — a single uppercase letter U rendered as a friendly humanist sans-serif glyph in warm clay brown, against soft beige textured paper background, hand-stamped or letterpress feel, subtle craft-warm aesthetic, single letter only, no other text, square centered composition, artisan brand identity',
    wordmark: 'Editorial wordmark for "MJB EVERYDAY UTILITY" — three lines of clean humanist sans-serif in warm dark brown stacked vertically with generous spacing, photographed on warm beige craft paper, a small clay-colored dot accent in the corner, minimalist editorial brand mark, no other graphics, vertical composition',
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });

async function generateOne(lane, kind, prompt, attempt = 1) {
  const start = Date.now();
  const submit = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: kind === 'initial' ? '1:1' : '3:2',
        output_format: 'png',
        safety_tolerance: 2,
        raw: false,
      },
    }),
  });
  if (submit.status === 429 && attempt < 6) {
    const wait = 15000 * attempt;
    console.log(`  [429] ${lane}-${kind} backoff ${wait}ms (attempt ${attempt + 1}/6)`);
    await new Promise(r => setTimeout(r, wait));
    return generateOne(lane, kind, prompt, attempt + 1);
  }
  if (!submit.ok) throw new Error(`submit ${submit.status} ${await submit.text()}`);
  let pred = await submit.json();
  while (pred.status === 'starting' || pred.status === 'processing') {
    await new Promise(r => setTimeout(r, 2500));
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  }
  if (pred.status !== 'succeeded') throw new Error(`pred ${pred.status}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const file = `${lane}-${kind}.png`;
  fs.writeFileSync(path.join(OUT_DIR, file), buf);
  return { lane, kind, file, bytes: buf.length, elapsedMs: Date.now() - start };
}

console.log(`[logos] generating ${brandLanes.lanes.length} × 2 = ${brandLanes.lanes.length * 2} logo variants`);
const jobs = [];
for (const lane of brandLanes.lanes) {
  for (const kind of ['initial', 'wordmark']) {
    jobs.push({ lane: lane.laneId, kind, prompt: PROMPTS[lane.laneId][kind] });
  }
}

// Skip already-generated to avoid wasted spend
const existing = fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) : {};
const todo = jobs.filter(j => {
  const haveFile = existing[j.lane]?.assets?.find(a => a.kind === j.kind)?.file;
  return !haveFile || !fs.existsSync(path.join(REPO_ROOT, haveFile));
});
console.log(`[logos] skipping ${jobs.length - todo.length} already-generated; ${todo.length} to do`);
// Sequential to avoid rate-limit
const results = [];
for (const j of todo) {
  try {
    const r = await generateOne(j.lane, j.kind, j.prompt);
    results.push({ status: 'fulfilled', value: r });
    await new Promise(r => setTimeout(r, 8000)); // 8s between to stay under per-min limit
  } catch (e) {
    results.push({ status: 'rejected', reason: e });
  }
}
const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);
for (const r of ok) console.log(`  [OK]   ${r.lane}-${r.kind.padEnd(10)} ${(r.bytes/1024).toFixed(0)}KB ${r.elapsedMs}ms`);
for (const e of failed) console.log(`  [FAIL] ${e.message?.slice(0, 80)}`);

const registry = {};
for (const r of ok) {
  registry[r.lane] ||= { laneId: r.lane, assets: [] };
  registry[r.lane].assets = registry[r.lane].assets.filter(a => a.kind !== r.kind);
  registry[r.lane].assets.push({ kind: r.kind, file: `mockups/real-trends/generated/logos/${r.file}`, bytes: r.bytes, generatedAt: new Date().toISOString() });
}
fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2));
console.log(`\nWrote ${ok.length}/${jobs.length} logos. Cost ~$${(ok.length * 0.06).toFixed(2)}. Registry: ${REGISTRY}`);
