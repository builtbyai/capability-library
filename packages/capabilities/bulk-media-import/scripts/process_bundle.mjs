#!/usr/bin/env node
/**
 * Stage 3: turn a browser-scraped bundle JSON into disk files ready for fast_upload.mjs.
 *
 * Bundle shape (from scrape_helpers.js / __scrapeFull):
 *   { jobs: [{ job_id: int, photos: [{n,id,p,o,tags,c}], docs: [{n,id,mime,size,b64,c}], errs: [] }] }
 *
 * What it does:
 *   1. Looks up destination row id for each source job_id via wrangler d1 execute
 *      (override the lookup SQL with --lookup-sql for non-RoofLink schemas)
 *   2. For each photo: parallel curl p.preview_url → {leadId}_p{rl_id}_{name}.{ext}
 *   3. For each doc: decode b64 → write to {leadId}_d{rl_id}_{name}.{ext}
 *
 * Output: files ready for fast_upload.mjs (same dir).
 *
 * Usage:
 *   bulk-media-process-bundle <bundle.json> [files_dir] [--lookup-sql "SELECT ..."] [--skip JOB_IDS]
 *
 * Env:
 *   WORKER_DIR, D1_NAME, CURL_PARALLELISM (default 8), SKIP_JOB_IDS, SKIP_PHOTOS_FOR_JOBS
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lookup-sql') args.lookupSql = argv[++i];
    else if (a === '--skip') args.skip = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) { console.error('unknown flag:', a); process.exit(2); }
    else positional.push(a);
  }
  args.bundlePath = positional[0];
  args.filesDir = positional[1];
  return args;
}

const args = parseArgs(process.argv);
if (args.help || !args.bundlePath) {
  console.log('Usage: bulk-media-process-bundle <bundle.json> [files_dir] [--lookup-sql SQL] [--skip JOB_IDS]');
  process.exit(args.help ? 0 : 2);
}

const BUNDLE_PATH = path.resolve(args.bundlePath);
const FILES_DIR = path.resolve(args.filesDir || path.join(path.dirname(BUNDLE_PATH), 'files'));
const WORKER_DIR = path.resolve(process.env.WORKER_DIR || process.cwd());
const D1_NAME = process.env.D1_NAME || 'impactiq-db';
const PAR = +(process.env.CURL_PARALLELISM || 8);
const SKIP_JOBS = new Set((args.skip || process.env.SKIP_JOB_IDS || '').split(',').map(s => +s).filter(Boolean));
const SKIP_PHOTOS_FOR = new Set((process.env.SKIP_PHOTOS_FOR_JOBS || '').split(',').map(s => +s).filter(Boolean));

if (!fs.existsSync(BUNDLE_PATH)) { console.error('bundle not found:', BUNDLE_PATH); process.exit(1); }
fs.mkdirSync(FILES_DIR, { recursive: true });

const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'));
if (!Array.isArray(bundle.jobs)) { console.error('bundle.jobs missing'); process.exit(1); }
console.log(`bundle jobs: ${bundle.jobs.length}`);

function safeName(n) { return String(n).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180); }
function sniffMime(buf) {
  if (buf[0]===0xFF&&buf[1]===0xD8&&buf[2]===0xFF) return 'image/jpeg';
  if (buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4E&&buf[3]===0x47) return 'image/png';
  if (buf[0]===0x25&&buf[1]===0x50&&buf[2]===0x44&&buf[3]===0x46) return 'application/pdf';
  return 'application/octet-stream';
}

// -------- lookup destination lead_ids --------
const jobIds = bundle.jobs.map(j => j.job_id);
const lookupSql = args.lookupSql || `SELECT id, rooflink_job_id FROM storm_leads WHERE rooflink_job_id IN (${jobIds.join(',')})`;
console.log(`lookup: wrangler d1 execute ${D1_NAME} --remote --command "${lookupSql.slice(0,80)}..."`);
const out = execSync(
  `wrangler d1 execute ${D1_NAME} --remote --json --command "${lookupSql.replace(/"/g,'\\"')}"`,
  { cwd: WORKER_DIR, encoding: 'utf8', maxBuffer: 50*1024*1024 }
);
const parsed = JSON.parse(out.replace(/^[^[]*/, ''));
const JOB_TO_LEAD = {};
for (const r of parsed[0].results) {
  // accept either named column or first column; column name varies by lookup SQL
  const id = r.id ?? r[Object.keys(r)[0]];
  const jobId = r.rooflink_job_id ?? r[Object.keys(r)[1]];
  if (id && jobId) JOB_TO_LEAD[jobId] = id;
}
console.log(`mapped lead_ids: ${Object.keys(JOB_TO_LEAD).length}/${jobIds.length}`);

// -------- prep work --------
const curlQueue = [];
let docCount = 0;
const skippedJobs = [];
for (const job of bundle.jobs) {
  if (SKIP_JOBS.has(job.job_id)) { skippedJobs.push(job.job_id); continue; }
  const leadId = JOB_TO_LEAD[job.job_id];
  if (!leadId) { console.warn('no lead_id for job', job.job_id); continue; }

  if (!SKIP_PHOTOS_FOR.has(job.job_id)) {
    for (const p of (job.photos || [])) {
      if (!p.p) continue;
      const ext = ((p.p.split('?')[0].split('.').pop()||'').toLowerCase()) || 'jpg';
      const baseName = safeName((p.n||`f${p.id}`).replace(/\.[^/.]+$/,''));
      const local = path.join(FILES_DIR, `${leadId}_p${p.id}_${baseName}.${ext}`);
      curlQueue.push({local, url: p.p});
    }
  }

  for (const d of (job.docs || [])) {
    if (!d.b64) continue;
    const buf = Buffer.from(d.b64, 'base64');
    const mime = (d.mime && d.mime !== 'binary/octet-stream') ? d.mime : sniffMime(buf);
    const ext = (mime === 'application/pdf') ? 'pdf' : (d.ext || 'bin');
    const baseName = safeName((d.n||`doc${d.id}`).replace(/\.[^/.]+$/,''));
    const local = path.join(FILES_DIR, `${leadId}_d${d.id}_${baseName}.${ext}`);
    fs.writeFileSync(local, buf);
    docCount++;
  }
}
console.log(`photos to curl: ${curlQueue.length}  docs already written: ${docCount}  skipped jobs: ${skippedJobs.length}`);

// -------- parallel curl --------
let curlOk=0, curlFail=0;
function curlOne(q) {
  try {
    execSync(`curl -sSfL -o "${q.local}" "${q.url}"`, { stdio: 'pipe' });
    const stat = fs.statSync(q.local);
    if (stat.size < 500) throw new Error('suspect size ' + stat.size);
    const buf = fs.readFileSync(q.local).subarray(0, 16);
    if (sniffMime(buf) === 'application/octet-stream') throw new Error('not a known image type');
    curlOk++;
  } catch (e) {
    curlFail++;
    if (curlFail < 3) console.error('CURL FAIL', q.url.slice(-60), e.message.slice(0,100));
    try { fs.unlinkSync(q.local); } catch {}
  }
  if ((curlOk+curlFail) % 25 === 0 || (curlOk+curlFail) === curlQueue.length) {
    process.stdout.write(`\r[${curlOk+curlFail}/${curlQueue.length}] curl ok=${curlOk} fail=${curlFail}`);
  }
}
async function curlAll() {
  for (let i = 0; i < curlQueue.length; i += PAR) {
    await Promise.all(curlQueue.slice(i, i + PAR).map(curlOne));
  }
}

const start = Date.now();
await curlAll();
console.log(`\nCurl ok=${curlOk} fail=${curlFail}  docs=${docCount}  elapsed=${((Date.now()-start)/1000).toFixed(1)}s`);
console.log('files dir:', FILES_DIR);
console.log('next: bulk-media-fast-upload "' + FILES_DIR + '"');
