#!/usr/bin/env node
/**
 * Verifier: checks that all prereqs are in place before a run.
 *
 *   node scripts/verify.mjs
 *
 * Confirms:
 *   - Node version >= 20
 *   - @aws-sdk/client-s3 installed
 *   - wrangler on PATH (and authenticated, if a worker dir is provided)
 *   - curl on PATH
 *   - R2 env vars present
 *   - R2 endpoint reachable + bucket exists (HeadBucket)
 *   - D1 reachable (if WORKER_DIR + D1_NAME provided)
 */

import process from 'node:process';
import { execSync } from 'node:child_process';

let ok = 0, fail = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r === false) { console.log(`✗ ${name}`); fail++; }
    else { console.log(`✓ ${name}${typeof r === 'string' ? ': ' + r : ''}`); ok++; }
  } catch (e) {
    console.log(`✗ ${name}: ${e.message.slice(0,200)}`);
    fail++;
  }
}

check('node >= 20', () => {
  const major = +process.versions.node.split('.')[0];
  if (major < 20) throw new Error('node ' + process.versions.node + ' too old');
  return 'node ' + process.versions.node;
});

await check('@aws-sdk/client-s3 importable', async () => {
  await import('@aws-sdk/client-s3');
  return 'loaded';
});

check('wrangler on PATH', () => {
  const v = execSync('wrangler --version', { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  return v.split('\n')[0];
});

check('curl on PATH', () => {
  const v = execSync('curl --version', { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).split('\n')[0];
  return v;
});

const requiredEnv = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET'];
for (const k of requiredEnv) {
  check('env ' + k, () => {
    const v = process.env[k];
    if (!v) throw new Error('missing');
    return k.includes('SECRET') ? '***' : (v.length < 20 ? v : v.slice(0,8) + '...');
  });
}

await check('R2 HeadBucket reachable', async () => {
  if (!process.env.R2_ACCESS_KEY_ID) throw new Error('skipped — env not set');
  const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  await s3.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET }));
  return process.env.R2_BUCKET + ' OK';
});

if (process.env.WORKER_DIR && process.env.D1_NAME) {
  check('D1 reachable', () => {
    const out = execSync(
      `wrangler d1 execute ${process.env.D1_NAME} --remote --command "SELECT 1 AS ok"`,
      { cwd: process.env.WORKER_DIR, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }
    );
    return 'OK';
  });
}

console.log(`\n${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
