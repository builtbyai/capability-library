#!/usr/bin/env node
/**
 * r2-put.mjs — shared R2 uploader used by every gen script + renderer.
 *
 * Reads credentials from %USERPROFILE%/.config/r2/r2.env:
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET, R2_ENDPOINT
 *
 * Worker proxy: https://dashboard-signaling.example.workers.dev/api/r2/file/<KEY>
 *
 * Usage as module:
 *   import { putR2 } from './r2-put.mjs';
 *   const result = await putR2('mjb/products/foo.png', '/path/to/local/foo.png');
 *   // result: { key, publicUrl, bytes, etag, uploadedAt }
 *
 * Usage as CLI:
 *   node r2-put.mjs <r2-key> <local-file>
 *
 * Manifest:
 *   Each successful upload appends to mockups/real-trends/r2-uploads.json
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Inline mime lookup (avoid extra dep)
const MIME_BY_EXT = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8', '.yml': 'text/yaml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const mime = { lookup: (p) => MIME_BY_EXT[path.extname(p).toLowerCase()] || null };

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'mockups', 'real-trends', 'r2-uploads.json');
// R2 public dev URL — enabled on mjb-commerce-media bucket 2026-06-30.
// Falls back to the dashboard-signaling worker proxy if the env points elsewhere.
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE || 'https://pub-f1a237b322724dba9f9a00c5092d372f.r2.dev').replace(/\/$/, '');
const WORKER_BASE = PUBLIC_BASE;

function loadCreds() {
  const envFile = path.join(os.homedir(), '.claude', 'secrets', 'r2-mjb.env');
  const env = {};
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  for (const k of ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET']) {
    if (!env[k] && process.env[k]) env[k] = process.env[k];
    if (!env[k]) throw new Error(`Missing ${k} in env or ~/.claude/secrets/r2-mjb.env`);
  }
  env.R2_ENDPOINT = env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  return env;
}

let _client = null;
let _creds = null;
function client() {
  if (_client) return _client;
  _creds = loadCreds();
  _client = new S3Client({
    region: 'auto',
    endpoint: _creds.R2_ENDPOINT,
    credentials: {
      accessKeyId: _creds.R2_ACCESS_KEY_ID,
      secretAccessKey: _creds.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
  });
  return _client;
}

function appendManifest(entry) {
  let m = [];
  if (fs.existsSync(MANIFEST_PATH)) {
    try { m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); } catch {}
  }
  // Dedup by key (latest wins)
  m = m.filter(x => x.key !== entry.key);
  m.push(entry);
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2));
}

/**
 * Upload a local file to R2 under the given key.
 * Returns { key, publicUrl, bytes, etag, uploadedAt, localPath, contentType }.
 * Throws on hard failure.
 */
export async function putR2(key, localPath, opts = {}) {
  const c = client();
  const body = fs.readFileSync(localPath);
  const bytes = body.length;
  const contentType = opts.contentType || mime.lookup(localPath) || 'application/octet-stream';
  const cacheControl = opts.cacheControl || (contentType.startsWith('image/') ? 'public, max-age=31536000' : 'public, max-age=300');
  const cmd = new PutObjectCommand({
    Bucket: _creds.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
    Metadata: opts.metadata,
  });
  const res = await c.send(cmd);
  const entry = {
    key,
    publicUrl: `${WORKER_BASE}/${encodeURI(key)}`,
    bytes,
    etag: res.ETag?.replace(/"/g, ''),
    contentType,
    localPath: path.relative(REPO_ROOT, localPath).replace(/\\/g, '/'),
    uploadedAt: new Date().toISOString(),
  };
  appendManifest(entry);
  return entry;
}

/**
 * Soft variant — never throws. Returns { ok, ... } so callers can `await tryPutR2(...)`
 * without try/catch in every place.
 */
export async function tryPutR2(key, localPath, opts = {}) {
  try {
    const entry = await putR2(key, localPath, opts);
    return { ok: true, ...entry };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e), key, localPath };
  }
}

// CLI usage
const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  const [, , key, local] = process.argv;
  if (!key || !local) { console.error('Usage: node r2-put.mjs <r2-key> <local-file>'); process.exit(1); }
  const r = await tryPutR2(key, local);
  if (r.ok) {
    console.log(`[OK]   ${r.key} (${(r.bytes/1024).toFixed(0)}KB)`);
    console.log(`       ${r.publicUrl}`);
  } else {
    console.error(`[FAIL] ${r.error}`);
    process.exit(1);
  }
}
