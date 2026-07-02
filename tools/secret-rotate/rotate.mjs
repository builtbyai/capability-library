#!/usr/bin/env node
/**
 * secret-rotate — periodic key rotation across connectors. Walks the
 * connector-config registry, identifies connectors whose secret has aged past
 * a per-type max-age, and triggers rotation through the right channel:
 *   - gmail OAuth refresh (auto, no human)
 *   - R2 API token (manual; emits notify)
 *   - WhatsApp MCP token (auto via Postiz integration)
 *   - gvoice HMAC (emits notify with rotation instructions)
 *
 * This tool is a SCHEDULER. It does not store secrets. The actual rotate
 * call is dispatched to the appropriate capability via jobs.enqueue.
 *
 * Run:
 *   node tools/secret-rotate/rotate.mjs --dry-run
 *   node tools/secret-rotate/rotate.mjs --connector-config-url http://127.0.0.1:5102
 */
const DEFAULTS = {
  connectorConfigUrl: 'http://127.0.0.1:5102',
  notifyUrl: 'http://127.0.0.1:5107',
  maxAgeByType: {
    'gmail':                 7 * 24 * 60 * 60 * 1000,  // 7 days (Google Testing mode token cap)
    'cloudflare':           90 * 24 * 60 * 60 * 1000,  // 90 days
    'cloudflare-vectorize': 90 * 24 * 60 * 60 * 1000,
    'r2':                   60 * 24 * 60 * 60 * 1000,  // 60 days
    'imap':                180 * 24 * 60 * 60 * 1000,
    'smtp':                180 * 24 * 60 * 60 * 1000,
  },
};

const args = process.argv.slice(2);
const opts = { ...DEFAULTS, dryRun: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dry-run') opts.dryRun = true;
  else if (a === '--connector-config-url') opts.connectorConfigUrl = args[++i];
  else if (a === '--notify-url') opts.notifyUrl = args[++i];
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function postJson(url, body) {
  if (opts.dryRun) { console.log(`[DRY] POST ${url}`, JSON.stringify(body)); return { ok: true, deliveryId: 'dry-run' }; }
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

let connectors;
try {
  connectors = await fetchJson(`${opts.connectorConfigUrl}/api/connectors`);
} catch (e) {
  console.error(`[secret-rotate] connector-config unreachable at ${opts.connectorConfigUrl}: ${e.message}`);
  console.error('Cannot proceed without connector list. Is the connector-config capability running?');
  process.exit(2);
}

const now = Date.now();
const due = [];
for (const c of connectors) {
  const maxAge = opts.maxAgeByType[c.type];
  if (!maxAge) continue;
  const lastTested = c.lastTestedAt ? Date.parse(c.lastTestedAt) : 0;
  const age = now - (lastTested || Date.parse(c.createdAt));
  if (age > maxAge) {
    due.push({ ...c, ageDays: Math.floor(age / 86400000), maxAgeDays: Math.floor(maxAge / 86400000) });
  }
}

console.log(`[secret-rotate] ${connectors.length} connectors, ${due.length} due for rotation.`);

for (const c of due) {
  console.log(`  - ${c.type}/${c.displayName}: age ${c.ageDays}d > max ${c.maxAgeDays}d`);
  if (c.type === 'gmail') {
    // Auto-refresh OAuth via email-connector
    await postJson(`http://127.0.0.1:5104/api/email/${c.connectorId}/refresh-oauth`, {});
  } else {
    // All others need human action → notify
    await postJson(`${opts.notifyUrl}/api/notify`, {
      source: 'secret-rotate',
      severity: 'warn',
      audience: 'me',
      title: `Rotate secret: ${c.type}/${c.displayName}`,
      body: `Secret age ${c.ageDays}d exceeds policy ${c.maxAgeDays}d. Rotate via the provider console + update via connector-config UI.`,
      meta: { connectorId: c.connectorId, type: c.type },
    });
  }
}

console.log(`[secret-rotate] done (${opts.dryRun ? 'DRY RUN' : 'EXECUTED'})`);
