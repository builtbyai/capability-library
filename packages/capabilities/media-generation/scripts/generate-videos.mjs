#!/usr/bin/env node
/**
 * generate-videos.mjs — generates 5-second lifestyle product videos via
 * Replicate, with per-model API shape adapters. Mirrors the patterns in
 * batch-generate-from-candidates.mjs (token load, sequential w/ backoff
 * retry on 429, auto-upload to R2, registry update keyed by candidateId).
 *
 * Models (--model <alias>):
 *   kling-pro  kwaivgi/kling-v1.6-pro          (~$0.25/clip, image+prompt, 5s default)
 *   hailuo     minimax/video-01                (~$0.50/clip, prompt + optional first_frame_image)
 *   wan        wan-video/wan-2.1-i2v-480p      (~$0.08/clip, image+prompt, image required)
 *   luma       luma/ray                        (~$0.40/clip, prompt + optional start_image_url)
 *
 * Usage:
 *   node generate-videos.mjs --model kling-pro
 *   node generate-videos.mjs --model wan --product pc_QjBCSEw0OUY5
 *   node generate-videos.mjs --all-models                 (1 demo / model, ~$1.25 total)
 *   node generate-videos.mjs --all-models --product cable-organizer
 *
 * --product accepts a candidateId (pc_*) OR a nicheId — in the niche case we
 * pick that niche's top-scored candidate.
 *
 * Outputs (per video):
 *   mockups/real-trends/generated/videos/<niche>/<slug>-<model>.mp4
 *   mockups/real-trends/generated/videos/index.json (registry keyed by candidateId)
 *
 * R2: mjb/videos/<niche>/<slug>-<model>.mp4 (via tryPutR2)
 *
 * Token: env REPLICATE_API_TOKEN, then ~/.claude/secrets/replicate.token
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const OUT_DIR = path.join(DATA_DIR, 'generated', 'videos');
const REGISTRY_PATH = path.join(OUT_DIR, 'index.json');

// ---- token ----
function loadToken() {
  const t = (process.env.REPLICATE_API_TOKEN || '').trim();
  if (t.startsWith('r8_')) return t;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'replicate.token');
  if (fs.existsSync(p)) {
    const v = fs.readFileSync(p, 'utf8').trim();
    if (v.startsWith('r8_')) return v;
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

function loadOpenaiKey() {
  const env = (process.env.OPENAI_API_KEY || '').trim();
  if (env) return env;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'openai.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('OPENAI_API_KEY not set and ~/.claude/secrets/openai.key not found');
}

// ---- model registry ----
// Each model maps its alias to: Replicate model slug, default input builder,
// rough USD cost estimate, and whether a seed image is required.
// Models with `customRun` skip the Replicate flow entirely.
const MODELS = {
  'kling-pro': {
    slug: 'kwaivgi/kling-v1.6-pro',
    costUsd: 0.25,
    imageRequired: false,
    buildInput: ({ prompt, imageUrl }) => {
      const input = {
        prompt,
        duration: 5,
        aspect_ratio: '9:16',
        cfg_scale: 0.5,
      };
      if (imageUrl) input.start_image = imageUrl;
      return input;
    },
  },
  'hailuo': {
    slug: 'minimax/video-01',
    costUsd: 0.50,
    imageRequired: false,
    buildInput: ({ prompt, imageUrl }) => {
      const input = { prompt, prompt_optimizer: true };
      if (imageUrl) input.first_frame_image = imageUrl;
      return input;
    },
  },
  'wan': {
    slug: 'wavespeedai/wan-2.1-i2v-480p',
    costUsd: 0.08,
    imageRequired: true,
    buildInput: ({ prompt, imageUrl }) => ({
      image: imageUrl,
      prompt,
      max_area: '832x480',
      num_frames: 81,            // ~5 seconds at 16fps
      frames_per_second: 16,
      sample_steps: 30,
      sample_shift: 3,
      sample_guide_scale: 5,
      fast_mode: 'Balanced',
    }),
  },
  'luma': {
    // luma/ray (legacy) no longer published; use ray-2-720p (quality) — luma/ray-flash-2-540p is the cheap tier
    slug: 'luma/ray-2-720p',
    costUsd: 0.40,
    imageRequired: false,
    buildInput: ({ prompt, imageUrl }) => {
      const input = {
        prompt,
        aspect_ratio: '9:16',
        duration: 5,
        loop: false,
      };
      if (imageUrl) input.start_image = imageUrl; // start_image_url is deprecated
      return input;
    },
  },
  'veo-3-fast': {
    // Google Veo 3 Fast via Gemini API — generates 5-8s clips WITH AUDIO
    slug: 'veo-3.0-fast-generate-001',
    costUsd: 2.00, // ~$0.40/sec × 5s
    imageRequired: false,
    customRun: (ctx) => runVeo(ctx),
  },
  'sora-2': {
    // OpenAI Sora 2 via /v1/videos — cinematic quality with audio
    slug: 'sora-2',
    costUsd: 0.50, // ~$0.10/sec × 5s (best-effort; tier-dependent)
    imageRequired: false,
    customRun: (ctx) => runSora(ctx),
  },
};

// ---- args ----
const args = process.argv.slice(2);
function arg(name, def = null) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
}
function flag(name) { return args.includes(name); }

const MODEL_ARG = arg('--model', null);
const ALL_MODELS = flag('--all-models');
const PRODUCT_ARG = arg('--product', null);
const DRY = flag('--dry-run');

if (!MODEL_ARG && !ALL_MODELS) {
  console.error('Usage: node generate-videos.mjs --model <kling-pro|hailuo|wan|luma>  OR  --all-models');
  console.error('       [--product <pc_id | nicheId>]');
  process.exit(1);
}
if (MODEL_ARG && !MODELS[MODEL_ARG]) {
  console.error(`Unknown model "${MODEL_ARG}". Available: ${Object.keys(MODELS).join(', ')}`);
  process.exit(1);
}

const modelAliases = ALL_MODELS ? Object.keys(MODELS) : [MODEL_ARG];

// ---- candidates ----
const candidates = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'candidates.json'), 'utf8'));

const candidateScore = (c) =>
  (c.competitiveContext?.isBestSeller ? 1000 : 0) +
  (c.competitiveContext?.isAmazonChoice ? 500 : 0) +
  (c.reviewSummary?.avgRating ?? 0) * 50 +
  Math.min(c.reviewSummary?.count ?? 0, 100000) * 0.001;

function pickCandidate(arg) {
  // If pc_*, find by id; else treat as nicheId and pick top
  const target = arg || 'drawer-organizer';
  if (target.startsWith('pc_')) {
    const found = candidates.find(c => c.id === target);
    if (!found) throw new Error(`No candidate with id ${target}`);
    return found;
  }
  const inNiche = candidates.filter(c => c._nicheId === target);
  if (inNiche.length === 0) throw new Error(`No candidates in niche ${target}`);
  return [...inNiche].sort((a, b) => candidateScore(b) - candidateScore(a))[0];
}

const cand = pickCandidate(PRODUCT_ARG);

// ---- helpers ----
function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
function shortName(c) {
  return (c.name || '').split(',')[0].split('(')[0].split('-')[0].trim().slice(0, 80);
}
function pickHeroImage(c) {
  const refs = c.mediaRefs || [];
  for (const r of refs) {
    if ((r.kind === 'image' || !r.kind) && r.sourceUrl) return r.sourceUrl;
  }
  return null;
}
function laneTone(c) {
  // mjb-home-finds → "warm cozy organized home", default → "clean modern lifestyle"
  if (c._lane?.includes('home')) return 'warm cozy organized real-home aesthetic';
  if (c._lane?.includes('tech')) return 'sleek modern minimalist tech aesthetic';
  return 'clean modern lifestyle aesthetic';
}
function composePrompt(c) {
  const name = shortName(c);
  const tone = laneTone(c);
  return `Cinematic 5-second lifestyle product video of a ${name}, smooth slow dolly-in camera move, soft natural light, ${tone}, vertical 9:16 framing, shallow depth of field, no on-screen text, no people faces`;
}

const SLUG = slugify(shortName(cand));
const NICHE = cand._nicheId;
const HERO_URL = pickHeroImage(cand);
const PROMPT = composePrompt(cand);

// ---- startup banner ----
console.log(`[videos] product:  ${shortName(cand)}`);
console.log(`[videos] id/niche: ${cand.id} / ${NICHE}`);
console.log(`[videos] hero img: ${HERO_URL || '(none)'}`);
console.log(`[videos] prompt:   "${PROMPT.slice(0, 120)}..."`);
console.log(`[videos] models:   ${modelAliases.join(', ')}`);
const plannedCost = modelAliases.reduce((s, m) => s + MODELS[m].costUsd, 0);
console.log(`[videos] planned cost: $${plannedCost.toFixed(2)}`);
console.log(`[videos] out dir:  ${OUT_DIR}`);
console.log('');

if (DRY) {
  for (const m of modelAliases) {
    const md = MODELS[m];
    console.log(`--- ${m} (${md.slug}) [$${md.costUsd}] ---`);
    if (md.customRun) {
      console.log(`{ "driver": "custom (gemini/openai)", "prompt": "${PROMPT.slice(0, 80)}...", "imageUrl": ${HERO_URL ? '"<set>"' : null} }`);
    } else {
      console.log(JSON.stringify(md.buildInput({ prompt: PROMPT, imageUrl: HERO_URL }), null, 2));
    }
  }
  process.exit(0);
}

fs.mkdirSync(path.join(OUT_DIR, NICHE), { recursive: true });

// ---- replicate driver ----
const POLL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min hard cap

async function submitPrediction(modelSlug, input, attempt = 1) {
  const res = await fetch(`https://api.replicate.com/v1/models/${modelSlug}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=30', // 30s sync wait, then we poll
    },
    body: JSON.stringify({ input }),
  });
  if (res.status === 429 && attempt < 4) {
    const wait = 12 * attempt;
    console.log(`  [rate-limit] HTTP 429 — backing off ${wait}s (attempt ${attempt})`);
    await new Promise(r => setTimeout(r, wait * 1000));
    return submitPrediction(modelSlug, input, attempt + 1);
  }
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`HTTP ${res.status}: ${txt.slice(0, 400)}`);
    err.httpCode = res.status;
    throw err;
  }
  return res.json();
}

async function pollUntilDone(pred) {
  const started = Date.now();
  let p = pred;
  while (p.status === 'starting' || p.status === 'processing') {
    if (Date.now() - started > POLL_TIMEOUT_MS) {
      throw new Error(`poll timeout after ${POLL_TIMEOUT_MS}ms — last status ${p.status}`);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
    const pr = await fetch(p.urls.get, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!pr.ok) {
      const txt = await pr.text();
      throw new Error(`poll HTTP ${pr.status}: ${txt.slice(0, 200)}`);
    }
    p = await pr.json();
  }
  return p;
}

function extractVideoUrl(pred) {
  const out = pred.output;
  if (!out) return null;
  if (typeof out === 'string') return out;
  if (Array.isArray(out)) {
    // Find first string that looks like a URL
    for (const x of out) if (typeof x === 'string' && /^https?:\/\//.test(x)) return x;
    return null;
  }
  if (typeof out === 'object') {
    // Some models nest under .video / .url
    return out.video || out.url || null;
  }
  return null;
}

// ---- gemini veo driver ----
async function runVeo({ alias, modelSlug, costUsd, prompt, imageUrl, filename, filepath, r2Key, startedAt }) {
  let KEY;
  try { KEY = loadGeminiKey(); }
  catch (e) { return failResult({ alias, modelSlug, stage: 'auth', reason: e.message, startedAt }); }

  // Optionally fetch+b64 the seed image for image-to-video
  let imagePart = null;
  if (imageUrl) {
    try {
      const r = await fetch(imageUrl);
      if (r.ok) {
        const ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
        if (ct.startsWith('image/')) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length < 8 * 1024 * 1024) {
            imagePart = { bytesBase64Encoded: buf.toString('base64'), mimeType: ct };
          }
        }
      }
    } catch { /* fall through to text-only */ }
  }
  // Veo 3 Fast has fixed 8s duration — durationSeconds/numberOfVideos rejected
  const body = {
    instances: [imagePart ? { prompt, image: imagePart } : { prompt }],
    parameters: { aspectRatio: '9:16', personGeneration: 'allow_adult' },
  };
  const subRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelSlug}:predictLongRunning`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!subRes.ok) {
    const txt = await subRes.text();
    return failResult({ alias, modelSlug, stage: 'submit', httpCode: subRes.status, reason: txt.slice(0, 400), startedAt });
  }
  const op = await subRes.json();
  console.log(`[${alias}] operation ${op.name} — polling`);

  const pollStart = Date.now();
  let final = op;
  while (!final.done) {
    if (Date.now() - pollStart > 8 * 60 * 1000) {
      return failResult({ alias, modelSlug, stage: 'poll', reason: 'timeout 8m', startedAt });
    }
    await new Promise(r => setTimeout(r, 5000));
    const pr = await fetch(`https://generativelanguage.googleapis.com/v1beta/${op.name}`, {
      headers: { 'x-goog-api-key': KEY },
    });
    if (!pr.ok) {
      return failResult({ alias, modelSlug, stage: 'poll', httpCode: pr.status, reason: (await pr.text()).slice(0, 400), startedAt });
    }
    final = await pr.json();
  }
  if (final.error) {
    return failResult({ alias, modelSlug, stage: 'prediction', reason: JSON.stringify(final.error).slice(0, 400), startedAt });
  }
  const resp = final.response || {};
  const samples = resp.generateVideoResponse?.generatedSamples
    || resp.generatedSamples || resp.predictions || resp.videos || [];
  let videoUri = null;
  for (const s of samples) {
    videoUri = s?.video?.uri || s?.uri || s?.video?.url || s?.url || null;
    if (videoUri) break;
  }
  if (!videoUri) {
    return failResult({ alias, modelSlug, stage: 'extract', reason: 'no video uri: ' + JSON.stringify(resp).slice(0, 300), costUsdEstimated: costUsd, startedAt });
  }
  const dl = await fetch(videoUri.includes('key=') ? videoUri : `${videoUri}${videoUri.includes('?') ? '&' : '?'}key=${KEY}`);
  if (!dl.ok) {
    return failResult({ alias, modelSlug, stage: 'download', httpCode: dl.status, reason: `HTTP ${dl.status}`, costUsdEstimated: costUsd, startedAt });
  }
  const buf = Buffer.from(await dl.arrayBuffer());
  fs.writeFileSync(filepath, buf);
  const upload = await tryPutR2(r2Key, filepath, { contentType: 'video/mp4' });
  return okResult({ alias, modelSlug, predictionId: op.name, filepath, filename, buf, videoUrl: videoUri, costUsd, upload, startedAt });
}

// ---- openai sora driver ----
async function runSora({ alias, modelSlug, costUsd, prompt, filename, filepath, r2Key, startedAt }) {
  let KEY;
  try { KEY = loadOpenaiKey(); }
  catch (e) { return failResult({ alias, modelSlug, stage: 'auth', reason: e.message, startedAt }); }

  const subRes = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    // sora-2 accepts seconds: '4' | '8' | '12' only
    body: JSON.stringify({ model: modelSlug, prompt, seconds: '8', size: '720x1280' }),
  });
  if (!subRes.ok) {
    const txt = await subRes.text();
    return failResult({ alias, modelSlug, stage: 'submit', httpCode: subRes.status, reason: txt.slice(0, 400), startedAt });
  }
  const v = await subRes.json();
  console.log(`[${alias}] video ${v.id} — polling`);

  let final = v;
  const pollStart = Date.now();
  while (final.status !== 'completed' && final.status !== 'failed') {
    if (Date.now() - pollStart > 8 * 60 * 1000) {
      return failResult({ alias, modelSlug, stage: 'poll', reason: 'timeout 8m', startedAt });
    }
    await new Promise(r => setTimeout(r, 5000));
    const pr = await fetch(`https://api.openai.com/v1/videos/${v.id}`, { headers: { Authorization: `Bearer ${KEY}` } });
    if (!pr.ok) {
      return failResult({ alias, modelSlug, stage: 'poll', httpCode: pr.status, reason: (await pr.text()).slice(0, 400), startedAt });
    }
    final = await pr.json();
  }
  if (final.status === 'failed') {
    return failResult({ alias, modelSlug, stage: 'prediction', reason: JSON.stringify(final.error || final).slice(0, 400), startedAt });
  }
  const dl = await fetch(`https://api.openai.com/v1/videos/${v.id}/content`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!dl.ok) {
    return failResult({ alias, modelSlug, stage: 'download', httpCode: dl.status, reason: `HTTP ${dl.status}`, costUsdEstimated: costUsd, startedAt });
  }
  const buf = Buffer.from(await dl.arrayBuffer());
  fs.writeFileSync(filepath, buf);
  const upload = await tryPutR2(r2Key, filepath, { contentType: 'video/mp4' });
  return okResult({ alias, modelSlug, predictionId: v.id, filepath, filename, buf, videoUrl: `https://api.openai.com/v1/videos/${v.id}/content`, costUsd, upload, startedAt });
}

function okResult({ alias, modelSlug, predictionId, filepath, filename, buf, videoUrl, costUsd, upload, startedAt }) {
  return {
    ok: true,
    alias, modelSlug, predictionId,
    filepath: path.relative(REPO_ROOT, filepath).replace(/\\/g, '/'),
    filename,
    bytes: buf.length,
    elapsedMs: Date.now() - startedAt,
    videoUrl,
    costUsdEstimated: costUsd,
    r2Key: upload.ok ? upload.key : null,
    r2Url: upload.ok ? upload.publicUrl : null,
    r2Error: upload.ok ? null : upload.error,
  };
}
function failResult({ alias, modelSlug, stage, httpCode, reason, costUsdEstimated, startedAt }) {
  return { ok: false, alias, modelSlug, stage, httpCode: httpCode ?? null, reason, costUsdEstimated: costUsdEstimated ?? 0, elapsedMs: Date.now() - startedAt };
}

async function runOne(alias, attemptCount) {
  const md = MODELS[alias];
  if (md.imageRequired && !HERO_URL) {
    throw new Error(`model ${alias} requires a seed image but candidate ${cand.id} has no mediaRefs image`);
  }
  const filename = `${SLUG}-${alias}.mp4`;
  const filepath = path.join(OUT_DIR, NICHE, filename);
  const r2Key = `mjb/videos/${NICHE}/${filename}`;
  const startedAt = Date.now();

  // Non-Replicate driver short-circuit
  if (md.customRun) {
    console.log(`[${alias}] submitting → ${md.slug} (est $${md.costUsd}, custom driver)`);
    return await md.customRun({
      alias, modelSlug: md.slug, costUsd: md.costUsd,
      prompt: PROMPT, imageUrl: HERO_URL,
      filename, filepath, r2Key, startedAt,
    });
  }

  const input = md.buildInput({ prompt: PROMPT, imageUrl: HERO_URL });
  console.log(`[${alias}] submitting → ${md.slug} (est $${md.costUsd}, image=${HERO_URL ? 'yes' : 'no'})`);

  let pred;
  try {
    pred = await submitPrediction(md.slug, input);
  } catch (e) {
    return {
      ok: false,
      alias,
      modelSlug: md.slug,
      stage: 'submit',
      httpCode: e.httpCode ?? null,
      reason: String(e?.message ?? e),
      costUsdEstimated: 0,
      elapsedMs: Date.now() - startedAt,
    };
  }

  console.log(`[${alias}] prediction ${pred.id} status=${pred.status} — polling`);
  let final;
  try {
    final = await pollUntilDone(pred);
  } catch (e) {
    return {
      ok: false,
      alias,
      modelSlug: md.slug,
      stage: 'poll',
      predictionId: pred.id,
      reason: String(e?.message ?? e),
      costUsdEstimated: 0,
      elapsedMs: Date.now() - startedAt,
    };
  }

  if (final.status !== 'succeeded') {
    return {
      ok: false,
      alias,
      modelSlug: md.slug,
      stage: 'prediction',
      predictionId: final.id,
      reason: `status=${final.status}: ${JSON.stringify(final.error ?? final.logs?.slice(-300) ?? '').slice(0, 400)}`,
      costUsdEstimated: 0,
      elapsedMs: Date.now() - startedAt,
    };
  }

  const videoUrl = extractVideoUrl(final);
  if (!videoUrl) {
    return {
      ok: false,
      alias,
      modelSlug: md.slug,
      stage: 'extract',
      predictionId: final.id,
      reason: `no video URL in output: ${JSON.stringify(final.output).slice(0, 300)}`,
      costUsdEstimated: md.costUsd, // model still ran
      elapsedMs: Date.now() - startedAt,
    };
  }

  // Download
  const dlRes = await fetch(videoUrl);
  if (!dlRes.ok) {
    return {
      ok: false,
      alias,
      modelSlug: md.slug,
      stage: 'download',
      predictionId: final.id,
      reason: `download HTTP ${dlRes.status}`,
      costUsdEstimated: md.costUsd,
      elapsedMs: Date.now() - startedAt,
    };
  }
  const buf = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync(filepath, buf);

  // R2 upload (soft)
  const upload = await tryPutR2(r2Key, filepath, { contentType: 'video/mp4' });

  return {
    ok: true,
    alias,
    modelSlug: md.slug,
    predictionId: final.id,
    filepath: path.relative(REPO_ROOT, filepath).replace(/\\/g, '/'),
    filename,
    bytes: buf.length,
    elapsedMs: Date.now() - startedAt,
    videoUrl,
    costUsdEstimated: md.costUsd,
    r2Key: upload.ok ? upload.key : null,
    r2Url: upload.ok ? upload.publicUrl : null,
    r2Error: upload.ok ? null : upload.error,
  };
}

// ---- sequential w/ 5s spacing ----
const SPACING_MS = 5000;
const results = [];
let rateLimitRetries = 0;

for (let i = 0; i < modelAliases.length; i++) {
  const alias = modelAliases[i];
  const r = await runOne(alias);
  results.push(r);
  if (r.ok) {
    console.log(`  [OK]   ${alias.padEnd(10)} ${(r.bytes / 1024).toFixed(0)}KB  ${(r.elapsedMs / 1000).toFixed(1)}s  -> ${r.filename}`);
    if (r.r2Url) console.log(`         R2: ${r.r2Url}`);
    else if (r.r2Error) console.log(`         R2 upload FAILED: ${r.r2Error}`);
  } else {
    console.log(`  [FAIL] ${alias.padEnd(10)} stage=${r.stage} ${r.httpCode ? `http=${r.httpCode} ` : ''}reason=${(r.reason || '').slice(0, 200)}`);
  }
  if (i < modelAliases.length - 1) {
    await new Promise(r => setTimeout(r, SPACING_MS));
  }
}

// ---- registry update (keyed by candidateId, sub-keyed by alias) ----
let registry = {};
if (fs.existsSync(REGISTRY_PATH)) {
  try { registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch {}
}
registry[cand.id] ||= {
  candidateId: cand.id,
  nicheId: NICHE,
  slug: SLUG,
  productName: shortName(cand),
  heroImageUrl: HERO_URL,
  prompt: PROMPT,
  videos: {},
};
registry[cand.id].productName = shortName(cand); // keep current
registry[cand.id].prompt = PROMPT;
registry[cand.id].heroImageUrl = HERO_URL;
for (const r of results) {
  if (!r.ok) {
    registry[cand.id].videos[r.alias] = {
      ok: false,
      modelSlug: r.modelSlug,
      generatedAt: new Date().toISOString(),
      stage: r.stage,
      reason: r.reason,
      httpCode: r.httpCode ?? null,
      costUsdEstimated: r.costUsdEstimated ?? 0,
    };
    continue;
  }
  registry[cand.id].videos[r.alias] = {
    ok: true,
    modelSlug: r.modelSlug,
    predictionId: r.predictionId,
    file: r.filepath,
    bytes: r.bytes,
    elapsedMs: r.elapsedMs,
    costUsdEstimated: r.costUsdEstimated,
    videoSourceUrl: r.videoUrl,
    r2Key: r.r2Key,
    r2Url: r.r2Url,
    generatedAt: new Date().toISOString(),
  };
}
fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

// ---- summary ----
const succeeded = results.filter(r => r.ok);
const failed = results.filter(r => !r.ok);
const totalCost = results.reduce((s, r) => s + (r.costUsdEstimated || 0), 0);

console.log('');
console.log('=== Summary ===');
console.log(`Succeeded: ${succeeded.length}/${results.length}`);
console.log(`Failed:    ${failed.length}`);
console.log(`Cost (est): $${totalCost.toFixed(2)}`);
console.log(`Registry:  ${REGISTRY_PATH}`);
console.log('');
for (const r of succeeded) {
  console.log(`  OK   ${r.alias.padEnd(10)} ${(r.bytes/1024).toFixed(0).padStart(5)}KB ${(r.elapsedMs/1000).toFixed(1).padStart(5)}s  ${r.filepath}`);
  if (r.r2Url) console.log(`       R2:    ${r.r2Url}`);
}
for (const r of failed) {
  console.log(`  FAIL ${r.alias.padEnd(10)} stage=${r.stage} ${r.httpCode ? `http=${r.httpCode} ` : ''}${(r.reason||'').slice(0, 200)}`);
}
