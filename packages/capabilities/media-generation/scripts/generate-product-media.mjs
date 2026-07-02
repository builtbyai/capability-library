#!/usr/bin/env node
/**
 * generate-product-media.mjs — generates photorealistic product media via
 * Replicate's black-forest-labs/flux-1.1-pro-ultra (current best photoreal
 * model on Replicate as of June 2026, ~$0.06/image, 1-8s wallclock).
 *
 * Outputs (per product):
 *   mockups/real-trends/generated/<slug>-hero.png       (clean studio shot)
 *   mockups/real-trends/generated/<slug>-lifestyle.png  (in-use context)
 *   mockups/real-trends/generated/<slug>-before-after.png (viral thumbnail)
 *
 * Usage:
 *   node generate-product-media.mjs            (defaults to drawer-pods product)
 *   node generate-product-media.mjs --product spice-rack
 *
 * Token: env REPLICATE_API_TOKEN, then %USERPROFILE%/.claude/secrets/replicate.token
 * Cost:  3 images × ~$0.06 = ~$0.18 per product (logged to console)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends', 'generated');
const REGISTRY_PATH = path.join(OUT_DIR, 'index.json');

function loadToken() {
  const envT = (process.env.REPLICATE_API_TOKEN || '').trim();
  if (envT.startsWith('r8_')) return envT;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'replicate.token');
  if (fs.existsSync(p)) {
    const t = fs.readFileSync(p, 'utf8').trim();
    if (t.startsWith('r8_')) return t;
  }
  throw new Error('REPLICATE_API_TOKEN not found in env or ~/.claude/secrets/replicate.token');
}

const TOKEN = loadToken();

function loadGeminiKey() {
  const env = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (env) return env;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'gemini.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('GEMINI_API_KEY not set and ~/.claude/secrets/gemini.key not found');
}

// --engine flux (Replicate, ~$0.06) | imagen-4 (Gemini API, ~$0.04)
const ENGINES = {
  'flux':     { model: 'black-forest-labs/flux-1.1-pro-ultra', costUsd: 0.06, driver: 'replicate' },
  'imagen-4': { model: 'imagen-4.0-generate-001',              costUsd: 0.04, driver: 'gemini' },
};

// ---- product catalog ----
const PRODUCTS = {
  'drawer-pods': {
    label: 'Easy-Snap Drawer Pods',
    prompts: {
      hero: 'Professional e-commerce product photography of modular cream-white silicone drawer organizer pods, 4 modular interlocking rectangular pieces snapped together, photographed centered on pure white seamless background, subtle soft shadow underneath, 30-degree elevated front angle, sharp studio focus, crisp commercial product photo, Amazon main listing style, no text or watermarks',
      lifestyle: 'Lifestyle photography top-down view of an organized kitchen utensil drawer, neatly arranged silver measuring spoons, wooden spatulas, and small cooking tools each in their own compartment of modular silicone organizer pods, warm natural daylight from window on left, light oak wood drawer interior, real home environment, cozy Pinterest-style home organization photography, no people, no text',
      'before-after': 'Vertical split-screen comparison thumbnail: left half shows a chaotic messy kitchen utensil drawer full of tangled silverware and spatulas spilling everywhere, right half shows the same drawer perfectly organized with cream silicone organizer pods sorting everything neatly into compartments, viral TikTok video thumbnail composition, high contrast lighting, dramatic before-after transformation, eye-catching social media composition, faint vertical white divider line in middle, no text overlay'
    }
  },
  'phone-mount': {
    label: 'Magnetic Phone Mount',
    prompts: {
      hero: 'Professional product photography of a sleek black magnetic car phone mount attached to a dashboard air vent, modern minimalist design with strong magnetic head, photographed on pure white seamless background, slight angle showing the magnetic surface and clip, sharp studio lighting, commercial Amazon listing style, no text',
      lifestyle: 'Lifestyle photo of a smartphone magnetically held on a sleek phone mount clipped to a car dashboard air vent, navigation app visible on screen, modern car interior, soft morning daylight through windshield, hands not visible, no text overlay',
      'before-after': 'Vertical split-screen viral thumbnail: left side shows a phone sliding off a dashboard during a turn with frustrated motion blur, right side shows the same phone firmly held by a magnetic mount on the air vent, dramatic before-after for social video, no text'
    }
  },
};

// ---- arg parsing ----
const args = process.argv.slice(2);
let productKey = 'drawer-pods';
let engineKey = 'flux';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--product' && args[i + 1]) productKey = args[i + 1];
  if (args[i] === '--engine' && args[i + 1]) engineKey = args[i + 1];
}
const product = PRODUCTS[productKey];
if (!product) {
  console.error(`Unknown product "${productKey}". Available: ${Object.keys(PRODUCTS).join(', ')}`);
  process.exit(1);
}
const engine = ENGINES[engineKey];
if (!engine) {
  console.error(`Unknown engine "${engineKey}". Available: ${Object.keys(ENGINES).join(', ')}`);
  process.exit(1);
}
const MODEL = engine.model;
const COST_PER_IMAGE_USD = engine.costUsd;

console.log(`[generate] product: ${product.label} (${productKey})`);
console.log(`[generate] engine:  ${engineKey} (${engine.driver})`);
console.log(`[generate] model:   ${MODEL}`);
console.log(`[generate] out:     ${OUT_DIR}`);
console.log('');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function generateViaReplicate(kind, prompt) {
  const startedAt = Date.now();
  const submitRes = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({ input: { prompt, aspect_ratio: '9:16', output_format: 'png', safety_tolerance: 2, raw: false } }),
  });
  if (!submitRes.ok) throw new Error(`[${kind}] submit HTTP ${submitRes.status}: ${(await submitRes.text()).slice(0, 300)}`);
  let pred = await submitRes.json();
  while (pred.status === 'starting' || pred.status === 'processing') {
    await new Promise(r => setTimeout(r, 2500));
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  }
  if (pred.status !== 'succeeded') throw new Error(`[${kind}] ${pred.status}: ${JSON.stringify(pred.error).slice(0, 200)}`);
  const outputUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!outputUrl) throw new Error(`[${kind}] no output URL`);
  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok) throw new Error(`[${kind}] download HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  return { buf, outputUrl, predictionId: pred.id, elapsedMs: Date.now() - startedAt };
}

async function generateViaGemini(kind, prompt) {
  const startedAt = Date.now();
  const KEY = loadGeminiKey();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '9:16', personGeneration: 'allow_adult' },
    }),
  });
  if (!res.ok) throw new Error(`[${kind}] imagen HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const pred = data.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded || pred?.image?.bytesBase64Encoded;
  if (!b64) throw new Error(`[${kind}] imagen returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  const buf = Buffer.from(b64, 'base64');
  return { buf, outputUrl: `imagen:${MODEL}`, predictionId: `imagen-${Date.now()}`, elapsedMs: Date.now() - startedAt };
}

async function generateOne(kind, prompt) {
  const r = engine.driver === 'gemini'
    ? await generateViaGemini(kind, prompt)
    : await generateViaReplicate(kind, prompt);
  const filename = `${productKey}-${kind}${engineKey === 'flux' ? '' : '-' + engineKey}.png`;
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, r.buf);
  return {
    kind, productKey, filename, filepath,
    bytes: r.buf.length,
    outputUrl: r.outputUrl,
    predictionId: r.predictionId,
    elapsedMs: r.elapsedMs,
    costUsdEstimated: COST_PER_IMAGE_USD,
  };
}

// Run all 3 in parallel
console.log(`[generate] submitting ${Object.keys(product.prompts).length} predictions in parallel...`);
const results = await Promise.allSettled(
  Object.entries(product.prompts).map(([kind, prompt]) => generateOne(kind, prompt))
);

const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
const failures = results.filter(r => r.status === 'rejected').map(r => r.reason);

for (const s of successes) {
  console.log(`  [OK]   ${s.kind.padEnd(13)} ${(s.bytes / 1024).toFixed(0)}KB  ${s.elapsedMs}ms  -> ${s.filename}`);
}
for (const f of failures) {
  console.log(`  [FAIL] ${f.message}`);
}

// Update registry index so the renderer can pick these up
let registry = {};
if (fs.existsSync(REGISTRY_PATH)) {
  try { registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch {}
}
registry[productKey] = {
  productLabel: product.label,
  generatedAt: new Date().toISOString(),
  model: MODEL,
  assets: successes.map(s => ({ kind: s.kind, file: s.filename, bytes: s.bytes, elapsedMs: s.elapsedMs, costUsdEstimated: s.costUsdEstimated, predictionId: s.predictionId })),
};
fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

const totalCost = successes.length * COST_PER_IMAGE_USD;
console.log('');
console.log('=== Summary ===');
console.log(`Generated: ${successes.length}/${results.length}`);
console.log(`Total cost (estimated): $${totalCost.toFixed(2)}`);
console.log(`Registry: ${REGISTRY_PATH}`);
