#!/usr/bin/env node
/**
 * Stage 4 + 5: fast R2 upload (AWS SDK, 32-parallel) + chunked D1 INSERT.
 *
 * Cross-platform: Windows / Linux / macOS.
 * Throughput: ~40 files/sec sustained (vs ~0.7/s with wrangler r2 object put).
 *
 * Usage:
 *   bulk-media-fast-upload <files_dir> [--dry-run] [--no-d1] [--bucket NAME] [--d1 NAME] [--worker-dir PATH]
 *
 * Env (all REQUIRED unless flagged via CLI):
 *   R2_ACCESS_KEY_ID         R2 S3-compatible access key
 *   R2_SECRET_ACCESS_KEY     R2 S3-compatible secret
 *   R2_ACCOUNT_ID            Cloudflare account UUID
 *   R2_BUCKET                R2 bucket name (or --bucket)
 *   WORKER_DIR               dir containing wrangler.toml for D1 (or --worker-dir, defaults to cwd)
 *   D1_NAME                  D1 database name (or --d1, defaults to impactiq-db)
 *   R2_PARALLELISM           default 32
 *   R2_RETRY                 default 3
 *   D1_CHUNK_SIZE            default 200
 *
 * Disk filename convention (parsed via regex):
 *   {leadId}_{p|d}{rl_id}_{baseName}.{ext}
 *   - leadId   = destination row id in storm_leads (or your equivalent FK)
 *   - p|d      = file_type photo / document
 *   - rl_id    = source-system file id (for audit trail)
 *   - baseName = sanitized filename
 *   - ext      = lowercase extension
 *
 * Outputs:
 *   {files_dir}/_fast_inserts.sql        full INSERT statements
 *   {files_dir}/_fast_inserts_chunk_N.sql  D1-sized chunks
 *   {files_dir}/_fast_summary.json       run summary (ok/fail/bytes/elapsed)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// -------- CLI + env parsing --------
function parseArgs(argv) {
  const args = { dryRun: false, noD1: false };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-d1') args.noD1 = true;
    else if (a === '--bucket') args.bucket = argv[++i];
    else if (a === '--d1') args.d1Name = argv[++i];
    else if (a === '--worker-dir') args.workerDir = argv[++i];
    else if (a === '--help' || a === '-h') { args.help = true; }
    else if (a.startsWith('--')) { console.error('unknown flag:', a); process.exit(2); }
    else positional.push(a);
  }
  args.filesDir = positional[0];
  return args;
}

const args = parseArgs(process.argv);
if (args.help || !args.filesDir) {
  console.log(`Usage: bulk-media-fast-upload <files_dir> [--dry-run] [--no-d1] [--bucket NAME] [--d1 NAME] [--worker-dir PATH]\n`);
  console.log('See manifest.yaml for full env + contract.');
  process.exit(args.help ? 0 : 2);
}

const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET     = process.env.R2_SECRET_ACCESS_KEY;
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET     = args.bucket || process.env.R2_BUCKET;
const D1_NAME    = args.d1Name || process.env.D1_NAME || 'impactiq-db';
const WORKER_DIR = path.resolve(args.workerDir || process.env.WORKER_DIR || process.cwd());
const PAR        = +(process.env.R2_PARALLELISM || 32);
const RETRY      = +(process.env.R2_RETRY || 3);
const CHUNK      = +(process.env.D1_CHUNK_SIZE || 200);

const missing = [];
if (!ACCESS_KEY) missing.push('R2_ACCESS_KEY_ID');
if (!SECRET)     missing.push('R2_SECRET_ACCESS_KEY');
if (!ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
if (!BUCKET)     missing.push('R2_BUCKET (or --bucket)');
if (missing.length) {
  console.error('Missing env: ' + missing.join(', '));
  console.error('Generate R2 token at https://dash.cloudflare.com/<account_id>/r2/api-tokens');
  console.error('Permission: Object Read & Write, scope to bucket, TTL 1hr for safety.');
  process.exit(1);
}

const FILES_DIR = path.resolve(args.filesDir);
if (!fs.existsSync(FILES_DIR) || !fs.statSync(FILES_DIR).isDirectory()) {
  console.error('Not a directory:', FILES_DIR);
  process.exit(1);
}
const SQL_OUT = path.join(FILES_DIR, '_fast_inserts.sql');
const SUMMARY = path.join(FILES_DIR, '_fast_summary.json');

// -------- S3 client --------
const s3 = new S3Client({
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET },
  maxAttempts: RETRY,
});

// -------- helpers --------
function sqlEscape(s) { if (s === null || s === undefined) return 'NULL'; return `'${String(s).replace(/'/g, "''")}'`; }
function sniffMime(buf) {
  if (buf[0]===0xFF&&buf[1]===0xD8&&buf[2]===0xFF) return 'image/jpeg';
  if (buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4E&&buf[3]===0x47) return 'image/png';
  if (buf[0]===0x47&&buf[1]===0x49&&buf[2]===0x46) return 'image/gif';
  if (buf[0]===0x52&&buf[1]===0x49&&buf[2]===0x46&&buf[3]===0x46&&buf[8]===0x57&&buf[9]===0x45&&buf[10]===0x42&&buf[11]===0x50) return 'image/webp';
  if (buf[0]===0x25&&buf[1]===0x50&&buf[2]===0x44&&buf[3]===0x46) return 'application/pdf';
  return 'application/octet-stream';
}

// -------- enumerate disk files --------
const files = fs.readdirSync(FILES_DIR)
  .filter(f => !f.startsWith('_') && !f.startsWith('.'))
  .filter(f => { const st = fs.statSync(path.join(FILES_DIR, f)); return st.isFile() && st.size > 0; });

console.log(`files on disk: ${files.length}`);

const FILENAME_RE = /^(\d+)_([pd])(\d+)_(.+)$/;
const queue = [];
let skipped = 0;
for (const f of files) {
  const m = f.match(FILENAME_RE);
  if (!m) { skipped++; if (skipped <= 3) console.warn('skip unparseable:', f); continue; }
  const [, leadId, kind, rlId, basenameExt] = m;
  const local = path.join(FILES_DIR, f);
  const stat = fs.statSync(local);
  const fd = fs.openSync(local, 'r');
  const header = Buffer.alloc(16);
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);
  const mime = sniffMime(header);
  const r2Uuid = crypto.randomUUID();
  // forward-slash r2_key for cross-platform consistency (R2 keys are not OS paths)
  const r2Key = `leads/${leadId}/${r2Uuid}-${basenameExt}`;
  queue.push({
    local, r2Key, mime, size: stat.size,
    leadId: +leadId,
    fileType: kind === 'p' ? 'photo' : 'document',
    fileName: basenameExt,
    rlId: +rlId,
  });
}
console.log(`queue: ${queue.length} (skipped ${skipped})`);
if (!queue.length) { console.log('nothing to upload'); process.exit(0); }

if (args.dryRun) {
  console.log('--dry-run: skipping R2 upload and D1 INSERT');
  console.log('sample queue[0]:', JSON.stringify(queue[0], null, 2));
  console.log('byLead sample:');
  const byLead = queue.reduce((a,q)=>{(a[q.leadId]=a[q.leadId]||{photos:0,docs:0,bytes:0}); a[q.leadId][q.fileType==='photo'?'photos':'docs']++; a[q.leadId].bytes+=q.size; return a;}, {});
  for (const [lid, s] of Object.entries(byLead).slice(0,10)) console.log(`  lead ${lid}: ${s.photos}p ${s.docs}d ${(s.bytes/1024).toFixed(0)}KB`);
  process.exit(0);
}

// -------- R2 upload (32-parallel by default) --------
let ok=0, fail=0, bytes=0;
const failures = [];
async function uploadOne(q) {
  try {
    const body = fs.readFileSync(q.local);
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: q.r2Key, Body: body, ContentType: q.mime }));
    ok++; bytes += q.size;
  } catch (e) {
    fail++;
    failures.push({ key: q.r2Key, err: String(e.message).slice(0,200) });
    q.err = e.message;
  }
  if ((ok+fail) % 50 === 0 || (ok+fail) === queue.length) {
    process.stdout.write(`\r[${ok+fail}/${queue.length}] ok=${ok} fail=${fail} ${(bytes/1024/1024).toFixed(1)}MB`);
  }
}
async function runAll() {
  for (let i = 0; i < queue.length; i += PAR) {
    await Promise.all(queue.slice(i, i + PAR).map(uploadOne));
  }
}

const start = Date.now();
await runAll();
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\nUPLOAD ok=${ok} fail=${fail} elapsed=${elapsed}s rate=${(ok/elapsed).toFixed(0)}/s`);
if (failures.length) console.log('first 3 failures:', failures.slice(0,3));

// -------- build INSERT SQL --------
const sql = [`-- bulk-media-import lead_files inserts (${new Date().toISOString()})`];
for (const q of queue.filter(q => !q.err)) {
  const desc = `Bulk import | source_id=${q.rlId} | ${new Date().toISOString().slice(0,10)}`;
  sql.push(
    `INSERT INTO lead_files (lead_id, file_type, file_name, file_size, mime_type, file_data, description, storage_provider, r2_key, source_url, tags, created_at, updated_at, visible_to_customer) VALUES (${q.leadId}, ${sqlEscape(q.fileType)}, ${sqlEscape(q.fileName)}, ${q.size}, ${sqlEscape(q.mime)}, ${sqlEscape('r2:'+q.r2Key)}, ${sqlEscape(desc)}, 'r2', ${sqlEscape(q.r2Key)}, '', '[]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1);`
  );
}
fs.writeFileSync(SQL_OUT, sql.join('\n'));
fs.writeFileSync(SUMMARY, JSON.stringify({
  ok, fail, bytes, elapsed: +elapsed, queueLen: queue.length,
  bucket: BUCKET, accountId: ACCOUNT_ID, d1Name: D1_NAME,
  failures: failures.slice(0,10),
}, null, 2));
console.log(`SQL written: ${SQL_OUT} (rows: ${sql.length-1})`);

if (args.noD1) {
  console.log('--no-d1: skipping D1 INSERT (run wrangler d1 execute manually)');
  process.exit(0);
}

// -------- chunked D1 INSERT (wrangler) --------
const inserts = sql.slice(1);
for (let i = 0; i < inserts.length; i += CHUNK) {
  const chunk = inserts.slice(i, i + CHUNK);
  const p = SQL_OUT.replace('.sql', `_chunk_${i/CHUNK}.sql`);
  fs.writeFileSync(p, chunk.join('\n'));
  console.log(`D1 chunk ${Math.floor(i/CHUNK)+1}/${Math.ceil(inserts.length/CHUNK)} (${chunk.length} rows)...`);
  try {
    execSync(`wrangler d1 execute ${D1_NAME} --remote --file "${p}"`, { cwd: WORKER_DIR, stdio: 'pipe' });
  } catch (e) {
    console.error('D1 chunk FAILED:', e.message.slice(0,200));
    console.error('Re-run manually:', `wrangler d1 execute ${D1_NAME} --remote --file "${p}"`);
    process.exit(1);
  }
}
console.log('\nDONE');
