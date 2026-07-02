#!/usr/bin/env node
/**
 * generate-avatar.mjs — text/image → 3D mesh (GLB) via Replicate.
 *
 * Models supported (--model):
 *   trellis      microsoft/trellis             ~$0.30  text+image to mesh (default)
 *   hunyuan3d    ndreca/hunyuan3d-2-multi-view ~$0.40  multi-view to mesh
 *   sf3d         stabilityai/stable-fast-3d    ~$0.04  image only, fast
 *
 * Output: GLB file at mockups/real-trends/generated/avatars/<slug>.glb
 *         + auto-uploaded to R2 mjb/avatars/<slug>.glb
 *
 * Usage:
 *   node generate-avatar.mjs --image <local-png-or-url> [--prompt "..."] [--model trellis]
 *   node generate-avatar.mjs --candidate pc_xxx [--model sf3d]   # uses candidate hero image
 *
 * Cost displayed up front; failure on 429 retries with backoff like other gen scripts.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends', 'generated', 'avatars');
const REGISTRY = path.join(OUT_DIR, 'index.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

const TOKEN = (process.env.REPLICATE_API_TOKEN || fs.readFileSync(path.join(os.homedir(), '.claude', 'secrets', 'replicate.token'), 'utf8')).trim();
if (!TOKEN.startsWith('r8_')) { console.error('REPLICATE_API_TOKEN missing'); process.exit(1); }

const MODELS = {
  trellis:   { slug: 'firtoz/trellis', cost: 0.30, input: (p) => ({ images: p.image ? [p.image] : undefined, seed: 0, randomize_seed: true, generate_color: true, generate_normal: true, generate_model: true, save_gaussian_ply: false, ss_sampling_steps: 38, slat_sampling_steps: 12, mesh_simplify: 0.95, texture_size: 1024 }) },
  hunyuan3d: { slug: 'ndreca/hunyuan3d-2', cost: 0.40, input: (p) => ({ image: p.image, caption: p.prompt || '', steps: 50, guidance_scale: 5.5, octree_resolution: 256, remove_background: true }) },
  sf3d:      { slug: 'firtoz/trellis', cost: 0.30, input: (p) => ({ images: p.image ? [p.image] : undefined, seed: 0, randomize_seed: true, generate_color: true, generate_normal: true, generate_model: true, save_gaussian_ply: false, ss_sampling_steps: 38, slat_sampling_steps: 12, mesh_simplify: 0.95, texture_size: 1024 }) }, // sf3d slug 404'd; fall back to trellis
};

function arg(name, def = null) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const modelKey = arg('--model', 'sf3d');
const model = MODELS[modelKey];
if (!model) { console.error(`Unknown model "${modelKey}". Available: ${Object.keys(MODELS).join(', ')}`); process.exit(1); }
const imagePath = arg('--image');
const candidateId = arg('--candidate');
const prompt = arg('--prompt') || '';
let imageInput;

if (candidateId) {
  const cands = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'mockups/real-trends/candidates.json'), 'utf8'));
  const c = cands.find(x => x.id === candidateId);
  if (!c) { console.error(`Candidate ${candidateId} not in candidates.json`); process.exit(1); }
  imageInput = c.mediaRefs?.[0]?.sourceUrl;
  if (!imageInput) { console.error('Candidate has no mediaRefs'); process.exit(1); }
  console.log(`[avatar] candidate ${candidateId}: ${c.name.slice(0, 60)}`);
  console.log(`[avatar] using Amazon CDN image: ${imageInput.slice(0, 80)}...`);
} else if (imagePath) {
  if (imagePath.startsWith('http')) {
    imageInput = imagePath;
  } else {
    // Encode local image as base64 data URL
    const ext = path.extname(imagePath).slice(1) || 'png';
    const buf = fs.readFileSync(imagePath);
    imageInput = `data:image/${ext};base64,${buf.toString('base64')}`;
    console.log(`[avatar] loaded local image: ${imagePath} (${(buf.length/1024).toFixed(0)}KB)`);
  }
} else {
  // Default: pick top-scored drawer-organizer candidate
  const cands = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'mockups/real-trends/candidates.json'), 'utf8'));
  const drawerCand = cands.find(c => c._nicheId === 'drawer-organizer' && c.competitiveContext?.isBestSeller) || cands.find(c => c._nicheId === 'drawer-organizer') || cands[0];
  imageInput = drawerCand.mediaRefs?.[0]?.sourceUrl;
  console.log(`[avatar] default: ${drawerCand.name.slice(0, 60)} (${drawerCand.id})`);
}

const slug = (candidateId || (imagePath ? path.basename(imagePath, path.extname(imagePath)) : 'avatar')) + '-' + modelKey;

console.log(`[avatar] model: ${model.slug}`);
console.log(`[avatar] cost: ~$${model.cost.toFixed(2)}`);
console.log('');

async function gen(attempt = 1) {
  const startedAt = Date.now();
  const submit = await fetch(`https://api.replicate.com/v1/models/${model.slug}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({ input: model.input({ image: imageInput, prompt }) }),
  });
  if (submit.status === 429 && attempt < 5) {
    const wait = 12000 * attempt;
    console.log(`[429] backoff ${wait}ms (attempt ${attempt + 1}/5)`);
    await new Promise(r => setTimeout(r, wait));
    return gen(attempt + 1);
  }
  if (!submit.ok) {
    const txt = await submit.text();
    throw new Error(`submit HTTP ${submit.status}: ${txt.slice(0, 300)}`);
  }
  let pred = await submit.json();
  console.log(`[avatar] prediction ${pred.id} status=${pred.status}`);
  let polls = 0;
  while (pred.status === 'starting' || pred.status === 'processing') {
    await new Promise(r => setTimeout(r, 3000));
    polls++;
    if (polls % 5 === 0) console.log(`  ...polling (${polls * 3}s elapsed)`);
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  }
  if (pred.status !== 'succeeded') {
    throw new Error(`prediction ${pred.status}: ${JSON.stringify(pred.error || {}).slice(0, 300)}`);
  }
  // Output shape varies per model — find the GLB URL
  let glbUrl = null, previewUrl = null;
  if (typeof pred.output === 'string' && pred.output.includes('.glb')) glbUrl = pred.output;
  else if (Array.isArray(pred.output)) glbUrl = pred.output.find(u => typeof u === 'string' && u.includes('.glb'));
  else if (pred.output?.model_file) glbUrl = pred.output.model_file;
  else if (pred.output?.mesh_glb) glbUrl = pred.output.mesh_glb;
  else if (pred.output?.combined) glbUrl = pred.output.combined;
  if (!glbUrl) {
    console.log('[avatar] DEBUG output shape:', JSON.stringify(pred.output).slice(0, 500));
    throw new Error('Could not find GLB URL in prediction output');
  }
  if (pred.output?.color_video) previewUrl = pred.output.color_video;

  // Download GLB
  console.log(`[avatar] downloading GLB from ${glbUrl.slice(0, 80)}...`);
  const buf = Buffer.from(await (await fetch(glbUrl)).arrayBuffer());
  const filename = `${slug}.glb`;
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, buf);
  console.log(`[avatar] saved ${(buf.length/1024).toFixed(0)}KB to ${filepath}`);

  // Auto-upload
  const upload = await tryPutR2(`mjb/avatars/${filename}`, filepath, { contentType: 'model/gltf-binary' });
  if (upload.ok) console.log(`[avatar] R2: ${upload.publicUrl}`);
  else console.log(`[avatar] R2 upload failed: ${upload.error}`);

  return { slug, modelKey, filename, file: path.relative(REPO_ROOT, filepath).replace(/\\/g, '/'), bytes: buf.length, elapsedMs: Date.now() - startedAt, predictionId: pred.id, r2Url: upload.ok ? upload.publicUrl : null };
}

try {
  const r = await gen();
  // Update registry
  let reg = {};
  if (fs.existsSync(REGISTRY)) { try { reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')); } catch {} }
  reg[r.slug] = { ...r, generatedAt: new Date().toISOString(), model: model.slug, costUsd: model.cost };
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2));

  console.log('');
  console.log('=== Summary ===');
  console.log(`Generated: ${r.filename}`);
  console.log(`Size:      ${(r.bytes/1024).toFixed(0)} KB`);
  console.log(`Wallclock: ${(r.elapsedMs/1000).toFixed(1)}s`);
  console.log(`Cost (est): $${model.cost.toFixed(2)}`);
  console.log(`R2:        ${r.r2Url || 'not uploaded'}`);
  console.log(`Registry:  ${REGISTRY}`);
} catch (e) {
  console.error('');
  console.error('[avatar] FAILED:', e.message);
  process.exit(1);
}
