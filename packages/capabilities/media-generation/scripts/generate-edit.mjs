#!/usr/bin/env node
/**
 * generate-edit.mjs — image edit/variation via Gemini 2.5 Flash Image ("Nano Banana").
 *
 * Takes an input image (local file OR https URL OR R2 key) + edit prompt,
 * returns an edited variant. Useful for:
 *   - A/B thumbnail variants from one hero shot
 *   - Background swap (white studio → lifestyle)
 *   - Quick prop additions / color tweaks
 *   - Style transfer
 *
 * Output: PNG saved to mockups/real-trends/generated/edits/<slug>.png
 *         + auto-uploaded to R2 under mjb/edits/<slug>.png
 *
 * Usage:
 *   node generate-edit.mjs --image <path-or-url> --prompt "Add warm sunset lighting" [--name <slug>]
 *   node generate-edit.mjs --r2-key mjb/products/cable-organizer/cable-management-hero.png \
 *                          --prompt "Place this product on a wooden desk in a sunlit home office" \
 *                          --name cable-mgmt-sunlit
 *
 * Cost: ~$0.04 per edit (Gemini 2.5 Flash Image pricing 2026-06)
 * Token: GEMINI_API_KEY env, then ~/.claude/secrets/gemini.key
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends', 'generated', 'edits');
const REGISTRY_PATH = path.join(OUT_DIR, 'index.json');
const MODEL = 'gemini-2.5-flash-image';
const COST_USD = 0.04;
const R2_PUBLIC_BASE = (process.env.R2_PUBLIC_BASE || 'https://pub-f1a237b322724dba9f9a00c5092d372f.r2.dev').replace(/\/$/, '');

fs.mkdirSync(OUT_DIR, { recursive: true });

function loadGeminiKey() {
  const env = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (env) return env;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'gemini.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('GEMINI_API_KEY not set and ~/.claude/secrets/gemini.key not found');
}
const KEY = loadGeminiKey();

function arg(name, def = null) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const IMAGE = arg('--image');
const R2_KEY = arg('--r2-key');
const PROMPT = arg('--prompt');
const NAME = arg('--name');

if (!PROMPT) { console.error('Usage: --prompt "<edit>" + one of: --image <path|url> | --r2-key <key>'); process.exit(1); }
if (!IMAGE && !R2_KEY) { console.error('Need --image or --r2-key'); process.exit(1); }

async function loadInputImage() {
  if (R2_KEY) {
    const url = `${R2_PUBLIC_BASE}/${encodeURI(R2_KEY)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`R2 fetch ${url} → HTTP ${r.status}`);
    return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type')?.split(';')[0] || 'image/png', source: url };
  }
  if (IMAGE.startsWith('http')) {
    const r = await fetch(IMAGE);
    if (!r.ok) throw new Error(`URL fetch ${IMAGE} → HTTP ${r.status}`);
    return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type')?.split(';')[0] || 'image/png', source: IMAGE };
  }
  const ext = path.extname(IMAGE).slice(1).toLowerCase() || 'png';
  return { buf: fs.readFileSync(IMAGE), mime: `image/${ext === 'jpg' ? 'jpeg' : ext}`, source: IMAGE };
}

console.log(`[edit] model: ${MODEL}`);
console.log(`[edit] prompt: "${PROMPT.slice(0, 120)}${PROMPT.length > 120 ? '...' : ''}"`);
const startedAt = Date.now();

const { buf: inputBuf, mime: inputMime, source } = await loadInputImage();
console.log(`[edit] input: ${source} (${(inputBuf.length/1024).toFixed(0)}KB ${inputMime})`);

const body = {
  contents: [{
    parts: [
      { text: PROMPT },
      { inline_data: { mime_type: inputMime, data: inputBuf.toString('base64') } },
    ],
  }],
};
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
  method: 'POST',
  headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`[edit] HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}
const data = await res.json();
const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
const out = part?.inlineData || part?.inline_data;
if (!out?.data) {
  console.error(`[edit] no image in response: ${JSON.stringify(data).slice(0, 400)}`);
  process.exit(1);
}
const outBuf = Buffer.from(out.data, 'base64');
const outMime = out.mimeType || out.mime_type || 'image/png';
const ext = outMime === 'image/jpeg' ? 'jpg' : outMime === 'image/webp' ? 'webp' : 'png';
const slug = (NAME || path.basename(source, path.extname(source)) + '-edit').replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 60);
const filename = `${slug}.${ext}`;
const filepath = path.join(OUT_DIR, filename);
fs.writeFileSync(filepath, outBuf);
const elapsedMs = Date.now() - startedAt;
console.log(`[edit] saved ${(outBuf.length/1024).toFixed(0)}KB to ${filepath} (${elapsedMs}ms)`);

const upload = await tryPutR2(`mjb/edits/${filename}`, filepath, { contentType: outMime });
if (upload.ok) console.log(`[edit] R2: ${upload.publicUrl}`);
else console.log(`[edit] R2 upload FAILED: ${upload.error}`);

let reg = {};
if (fs.existsSync(REGISTRY_PATH)) { try { reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); } catch {} }
reg[slug] = {
  slug, filename, file: path.relative(REPO_ROOT, filepath).replace(/\\/g, '/'),
  bytes: outBuf.length, mime: outMime, elapsedMs,
  model: MODEL, costUsd: COST_USD,
  prompt: PROMPT, source,
  r2Key: upload.ok ? upload.key : null,
  r2Url: upload.ok ? upload.publicUrl : null,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2));

console.log('');
console.log('=== Summary ===');
console.log(`Edit:     ${filename}`);
console.log(`Size:     ${(outBuf.length/1024).toFixed(0)} KB`);
console.log(`Wallclock: ${(elapsedMs/1000).toFixed(1)}s`);
console.log(`Cost:     ~$${COST_USD.toFixed(2)}`);
console.log(`R2:       ${upload.ok ? upload.publicUrl : '(failed)'}`);
console.log(`Registry: ${REGISTRY_PATH}`);
