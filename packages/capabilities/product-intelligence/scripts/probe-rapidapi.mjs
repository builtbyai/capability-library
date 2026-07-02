#!/usr/bin/env node
/**
 * probe-rapidapi.mjs — tests which RapidAPI providers the local key has access to.
 *
 * Each RapidAPI provider requires a separate subscription on rapidapi.com.
 * This script hits 5 of the shortlist providers from
 * `packages/capabilities/product-intelligence/kb/rapidapi-research.md` with
 * the minimum-cost call available, and reports per-provider:
 *   - HTTP status (200 = subscribed + working; 403 = not subscribed;
 *     401 = bad key; 429 = rate-limit hit; other = inspect manually)
 *   - whether the response body is JSON
 *   - the first 2-3 field names from the response (for shape verification)
 *
 * Usage:
 *   node packages/capabilities/product-intelligence/scripts/probe-rapidapi.mjs
 *
 * Key source: env RAPIDAPI_KEY, then %USERPROFILE%/.claude/secrets/rapidapi.key
 *
 * Cost: each probe call is the cheapest possible (single-product lookup or
 * 1-item search). Total cost should be well under $0.05 even if all succeed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function loadKey() {
  const envKey = (process.env.RAPIDAPI_KEY || '').trim();
  if (envKey.length > 20) return { key: envKey, source: 'env RAPIDAPI_KEY' };
  const candidatePaths = [
    path.join(os.homedir(), '.claude', 'secrets', 'rapidapi.key'),
    'G:/PROJECTS/secrets/rapidapi.key',
  ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const v = fs.readFileSync(p, 'utf8').trim();
        if (v.length > 20) return { key: v, source: p };
      }
    } catch {}
  }
  throw new Error('RAPIDAPI_KEY not found in env or ~/.claude/secrets/rapidapi.key');
}

const { key, source } = loadKey();
console.log(`[probe] key source: ${source} (${key.length} chars)`);
console.log('');

/**
 * Each probe targets one provider on the shortlist with the smallest
 * working call we can make. `host` is the RapidAPI host header (mandatory).
 * Endpoints below are from each provider's RapidAPI docs page; they are
 * stable public URL shapes — if a provider changes their API surface, the
 * probe will report a non-200 and you adjust here.
 */
const probes = [
  {
    id: 'real-time-amazon-data',
    label: 'Real-Time Amazon Data',
    host: 'real-time-amazon-data.p.rapidapi.com',
    path: '/search?query=drawer+organizer&page=1&country=US&sort_by=RELEVANCE&product_condition=ALL',
    expectField: 'data',
  },
  {
    id: 'amazon-online-data-api',
    label: 'Amazon Online Data API',
    host: 'amazon-online-data-api.p.rapidapi.com',
    path: '/search?query=drawer+organizer&country=US',
    expectField: 'products',
  },
  {
    id: 'axesso-amazon',
    label: 'Axesso - Amazon Data Service',
    host: 'axesso-axesso-amazon-data-service-v1.p.rapidapi.com',
    path: '/amz/amazon-search-by-keyword-asin?domainCode=com&keyword=drawer+organizer&page=1&sortBy=relevanceblender',
    expectField: 'searchProductDetails',
  },
  {
    id: 'amazon-product-info',
    label: 'Amazon Product Info',
    host: 'amazon-product-info.p.rapidapi.com',
    path: '/product/?asin=B07ZPKBL9V&language=EN_US',
    expectField: 'asin',
  },
  {
    id: 'taobao-1688-api',
    label: 'Taobao 1688 API',
    host: 'taobao-1688-api.p.rapidapi.com',
    path: '/1688/keywordSearch?keyword=drawer+organizer&page=1',
    expectField: 'data',
  },
];

const results = [];

for (const probe of probes) {
  const startedAt = Date.now();
  const url = `https://${probe.host}${probe.path}`;
  let status = 0, contentType = '', bodyHead = '', shape = '', errorMsg = '';
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': probe.host,
        'accept': 'application/json',
      },
    });
    status = res.status;
    contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    bodyHead = text.slice(0, 200).replace(/\s+/g, ' ');
    if (status === 200 && contentType.includes('json')) {
      try {
        const obj = JSON.parse(text);
        const topKeys = Object.keys(obj).slice(0, 5);
        shape = `top-level keys: [${topKeys.join(', ')}]`;
        // Try to count "items" returned, by common conventions
        const arr =
          (Array.isArray(obj.data?.products) && obj.data.products) ||
          (Array.isArray(obj.products) && obj.products) ||
          (Array.isArray(obj.searchProductDetails) && obj.searchProductDetails) ||
          (Array.isArray(obj.data) && obj.data) ||
          (Array.isArray(obj.results) && obj.results) ||
          null;
        if (arr) shape += `; item count: ${arr.length}`;
      } catch (e) {
        shape = 'JSON parse failed';
      }
    }
  } catch (e) {
    errorMsg = String(e?.message ?? e);
  }
  const elapsedMs = Date.now() - startedAt;
  const r = { id: probe.id, label: probe.label, host: probe.host, status, elapsedMs, contentType, shape, errorMsg, bodyHead };
  results.push(r);
  const tag =
    status === 200 ? 'OK' :
    status === 403 ? 'NOT SUBSCRIBED' :
    status === 401 ? 'BAD KEY' :
    status === 429 ? 'RATE LIMITED' :
    status === 0 ? 'NETWORK ERROR' :
    `HTTP ${status}`;
  console.log(`[${tag}] ${probe.label.padEnd(32)} ${elapsedMs}ms  ${shape || bodyHead.slice(0, 80)}`);
}

console.log('');
console.log('=== Summary ===');
const ok = results.filter(r => r.status === 200);
const notSubbed = results.filter(r => r.status === 403);
const other = results.filter(r => r.status !== 200 && r.status !== 403);
console.log(`Subscribed + working: ${ok.length}/${results.length}`);
if (ok.length > 0) console.log('  -> ' + ok.map(r => r.id).join(', '));
console.log(`Not subscribed (403): ${notSubbed.length}`);
if (notSubbed.length > 0) console.log('  -> ' + notSubbed.map(r => r.id).join(', '));
console.log(`Other issues: ${other.length}`);
if (other.length > 0) {
  for (const r of other) {
    console.log(`  -> ${r.id}: status=${r.status} body="${r.bodyHead.slice(0, 120)}" err="${r.errorMsg}"`);
  }
}

// Write full report to disk for further analysis
const reportPath = path.join(process.cwd(), 'mockups', 'rapidapi-probe-report.json');
try {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nFull report: ${reportPath}`);
} catch (e) {
  console.log(`\nReport write failed: ${e.message}`);
}
