#!/usr/bin/env node
/**
 * pull-trends.mjs — pulls real product data from the user's subscribed
 * RapidAPI providers (Real-Time Amazon Data + Taobao DataHub) for several
 * MJB-relevant niches, then maps results to the canonical ProductCandidate
 * shape (packages/capabilities/product-intelligence/contracts/product-candidate.ts).
 *
 * Outputs:
 *   mockups/real-trends/<niche>.amazon.json  — raw responses
 *   mockups/real-trends/<niche>.taobao.json
 *   mockups/real-trends/candidates.json      — normalized ProductCandidate[]
 *   mockups/real-trends/summary.json         — per-niche counts + cost estimate
 *
 * Each call is the smallest paged result. Total cost on free tier should be
 * well under quota for both providers.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const OUT_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');

function loadKey() {
  const envKey = (process.env.RAPIDAPI_KEY || '').trim();
  if (envKey.length > 20) return envKey;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'rapidapi.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('RAPIDAPI_KEY not found');
}

const KEY = loadKey();

// ---- HTTP helper ---------------------------------------------------------
async function rapidGET(host, pathAndQuery) {
  const url = `https://${host}${pathAndQuery}`;
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': KEY,
        'x-rapidapi-host': host,
        'accept': 'application/json',
      },
    });
    const elapsedMs = Date.now() - startedAt;
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, elapsedMs, body, raw: text.slice(0, 1000) };
  } catch (e) {
    return { ok: false, status: 0, elapsedMs: Date.now() - startedAt, error: String(e?.message ?? e) };
  }
}

// ---- Niches to pull (MJB-relevant from your brand lanes) -----------------
const NICHES = [
  // mjb-home-finds (4)
  { id: 'drawer-organizer',     query: 'drawer organizer kitchen',         lane: 'mjb-home-finds' },
  { id: 'spice-rack',           query: 'rotating spice rack',              lane: 'mjb-home-finds' },
  { id: 'bathroom-organizer',   query: 'bathroom counter organizer',       lane: 'mjb-home-finds' },
  { id: 'closet-organizer',     query: 'closet shelf organizer',           lane: 'mjb-home-finds' },
  // mjb-tech-finds (3)
  { id: 'phone-mount',          query: 'magnetic phone mount car',         lane: 'mjb-tech-finds' },
  { id: 'cable-organizer',      query: 'desk cable organizer',             lane: 'mjb-tech-finds' },
  { id: 'magnetic-charger',     query: 'magsafe wireless charger stand',   lane: 'mjb-tech-finds' },
  // mjb-everyday-utility (3)
  { id: 'silicone-utensil',     query: 'silicone kitchen utensil',         lane: 'mjb-everyday-utility' },
  { id: 'travel-bottle',        query: 'leakproof travel water bottle',    lane: 'mjb-everyday-utility' },
  { id: 'lint-roller',          query: 'reusable lint roller',             lane: 'mjb-everyday-utility' },
];

// ---- Adapters ------------------------------------------------------------
const AMAZON_HOST = 'real-time-amazon-data.p.rapidapi.com';
const TAOBAO_HOST = 'taobao-datahub.p.rapidapi.com';

async function pullAmazonSearch(query) {
  const q = encodeURIComponent(query);
  return rapidGET(AMAZON_HOST, `/search?query=${q}&page=1&country=US&sort_by=RELEVANCE&product_condition=ALL`);
}

// Taobao DataHub endpoint paths (try a few — common conventions for taobao
// scrapers on RapidAPI). The first one that returns 200 wins.
async function pullTaobaoSearch(query) {
  const q = encodeURIComponent(query);
  const candidates = [
    `/item_search?q=${q}&page=1`,
    `/api/item_search?q=${q}&page=1`,
    `/search?q=${q}&page=1`,
  ];
  for (const candidatePath of candidates) {
    const res = await rapidGET(TAOBAO_HOST, candidatePath);
    if (res.ok || (res.status >= 200 && res.status < 300)) {
      return { ...res, path: candidatePath };
    }
    // 404 = endpoint wrong; try next. Other non-2xx (401/403/429) = stop trying.
    if (res.status !== 404 && res.status !== 0) {
      return { ...res, path: candidatePath };
    }
  }
  return { ok: false, status: 404, error: 'no taobao endpoint path matched', triedPaths: candidates };
}

// ---- Normalizer: Amazon search row -> ProductCandidate -------------------
function amazonToProductCandidate(row, niche) {
  if (!row || !row.asin) return null;
  const priceUsd =
    typeof row.product_price === 'string'
      ? parseFloat(row.product_price.replace(/[^0-9.]/g, '')) || undefined
      : (typeof row.product_price === 'number' ? row.product_price : undefined);
  const ratingNum =
    typeof row.product_star_rating === 'string'
      ? parseFloat(row.product_star_rating)
      : (typeof row.product_star_rating === 'number' ? row.product_star_rating : undefined);
  const reviewCount =
    typeof row.product_num_ratings === 'number' ? row.product_num_ratings : undefined;
  return {
    id: `pc_${Buffer.from(row.asin).toString('base64url').slice(0, 12)}`,
    source: 'amazon',
    sourceId: row.asin,
    discoveredAt: new Date().toISOString(),
    name: row.product_title || row.product_name || '(no title)',
    description: row.product_description ?? '',
    priceUsd,
    currencyOriginal: 'USD',
    priceOriginal: priceUsd,
    urls: [row.product_url].filter(Boolean),
    mediaRefs: row.product_photo
      ? [{ kind: 'image', sourceUrl: row.product_photo }]
      : [],
    supplierHint: undefined,
    socialSignals: undefined,
    reviewSummary:
      ratingNum != null && reviewCount != null
        ? { count: reviewCount, avgRating: ratingNum, topPositive: [], topNegative: [] }
        : undefined,
    competitiveContext: { provider: 'real-time-amazon-data', isPrime: !!row.is_prime, isBestSeller: !!row.is_best_seller, isAmazonChoice: !!row.is_amazon_choice, salesVolume: row.sales_volume ?? null },
    rawSnapshot: row,
    _nicheId: niche.id,
    _lane: niche.lane,
  };
}

// Best-effort normalizer for Taobao DataHub. Shapes vary — we read defensively.
function taobaoToSupplierCandidate(row, niche) {
  if (!row) return null;
  const name = row.title || row.name || row.product_name || row.item_title || '(no title)';
  // Taobao DataHub: sku.def.{price,promotionPrice}; fallback to flat price fields
  const pricePart =
    row.sku?.def?.promotionPrice ??
    row.sku?.def?.price ??
    row.price ??
    row.zk_final_price ??
    row.original_price ??
    row.priceText ??
    null;
  let priceCny = null;
  if (typeof pricePart === 'string') priceCny = parseFloat(pricePart.replace(/[^0-9.]/g, '')) || null;
  else if (typeof pricePart === 'number') priceCny = pricePart;
  const priceUsdApprox = priceCny != null ? Math.round((priceCny / 7.2) * 100) / 100 : undefined;
  const sourceId = row.itemId || row.num_iid || row.item_id || row.id || row.product_id || null;
  const image = row.image ? (row.image.startsWith('//') ? 'https:' + row.image : row.image) : null;
  const url = row.itemUrl ? (row.itemUrl.startsWith('//') ? 'https:' + row.itemUrl : row.itemUrl) : null;
  return {
    id: `sc_${Math.random().toString(36).slice(2, 14)}`,
    source: 'taobao',
    supplierName: row.shop_name || row.seller_nick || row.nick || row.shop || '(unknown shop)',
    region: 'CN',
    ratingPct: row.shop_rate ?? row.rating ?? undefined,
    moq: row.moq ?? undefined,
    leadTimeDays: undefined,
    pricePerUnitUsd: priceUsdApprox,
    productMatchConfidence: 0.5,
    urls: [url].filter(Boolean),
    rawSnapshot: row,
    _nicheId: niche.id,
    _lane: niche.lane,
    _priceOriginal: { value: priceCny, currency: 'CNY' },
    _productName: name,
    _sourceId: sourceId,
    _image: image,
    _sales: row.sales,
    _shippingFrom: row._delivery?.shippingFrom,
  };
}

// ---- Main ----------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });
const allCandidates = [];
const allSuppliers = [];
const summary = { startedAt: new Date().toISOString(), niches: [] };

console.log(`[pull-trends] key OK (${KEY.length} chars)`);
console.log(`[pull-trends] out dir: ${OUT_DIR}`);
console.log('');

// Probe both providers with a single call first, fail fast if unsubscribed.
console.log('[probe] testing subscriptions...');
const amazonProbe = await pullAmazonSearch('test');
console.log(`  Real-Time Amazon Data: HTTP ${amazonProbe.status} (${amazonProbe.elapsedMs}ms)`);
const taobaoProbe = await pullTaobaoSearch('test');
console.log(`  Taobao DataHub:        HTTP ${taobaoProbe.status} (${taobaoProbe.elapsedMs}ms) path=${taobaoProbe.path || '(none worked)'}`);
console.log('');

if (amazonProbe.status === 403) {
  console.error('Amazon: not subscribed. Aborting.');
  process.exit(1);
}

const taobaoWorks = taobaoProbe.status >= 200 && taobaoProbe.status < 300;
const successfulTaobaoPath = taobaoWorks ? taobaoProbe.path : null;

for (const niche of NICHES) {
  console.log(`[niche:${niche.id}] querying for "${niche.query}"`);
  const nicheRecord = { id: niche.id, query: niche.query, lane: niche.lane, amazon: { status: null, count: 0 }, taobao: { status: null, count: 0 } };

  // ---- Amazon search ----
  const amzRes = await pullAmazonSearch(niche.query);
  nicheRecord.amazon.status = amzRes.status;
  nicheRecord.amazon.elapsedMs = amzRes.elapsedMs;
  fs.writeFileSync(path.join(OUT_DIR, `${niche.id}.amazon.json`), JSON.stringify(amzRes.body ?? { raw: amzRes.raw }, null, 2));
  // Real-Time Amazon Data shape: { data: { products: [...] }, ... }
  const amzProducts = amzRes.body?.data?.products ?? amzRes.body?.products ?? [];
  let amzKept = 0;
  for (const row of amzProducts.slice(0, 10)) { // cap 10 per niche to keep storage small
    const cand = amazonToProductCandidate(row, niche);
    if (cand) { allCandidates.push(cand); amzKept++; }
  }
  nicheRecord.amazon.count = amzKept;
  console.log(`  amazon: HTTP ${amzRes.status}, kept ${amzKept} candidates`);

  // ---- Taobao supplier search ----
  if (taobaoWorks && successfulTaobaoPath) {
    // Reuse the successful path pattern; substitute the niche query
    const q = encodeURIComponent(niche.query);
    const pathToUse = successfulTaobaoPath.replace(/q=test/i, `q=${q}`);
    const tbRes = await rapidGET(TAOBAO_HOST, pathToUse);
    nicheRecord.taobao.status = tbRes.status;
    nicheRecord.taobao.elapsedMs = tbRes.elapsedMs;
    fs.writeFileSync(path.join(OUT_DIR, `${niche.id}.taobao.json`), JSON.stringify(tbRes.body ?? { raw: tbRes.raw }, null, 2));
    // Try several common shape conventions
    const tbItems =
      tbRes.body?.result?.resultList ??
      tbRes.body?.result?.item ??
      tbRes.body?.result?.items ??
      tbRes.body?.items ??
      tbRes.body?.data?.items ??
      tbRes.body?.data?.products ??
      tbRes.body?.data ??
      [];
    const tbArr = Array.isArray(tbItems) ? tbItems : [];
    let tbKept = 0;
    for (const wrapper of tbArr.slice(0, 5)) {
      // Taobao DataHub wraps each row as { item: {...}, delivery: {...} }
      const row = wrapper?.item ? { ...wrapper.item, _delivery: wrapper.delivery } : wrapper;
      const sup = taobaoToSupplierCandidate(row, niche);
      if (sup) { allSuppliers.push(sup); tbKept++; }
    }
    nicheRecord.taobao.count = tbKept;
    console.log(`  taobao: HTTP ${tbRes.status}, kept ${tbKept} supplier candidates`);
  } else {
    nicheRecord.taobao.status = 'skipped (no working endpoint path)';
    console.log(`  taobao: skipped`);
  }

  summary.niches.push(nicheRecord);
}

// Cross-reference: for each Amazon candidate, find the cheapest Taobao
// supplier candidate from the same niche, and mark a probable supply link.
for (const cand of allCandidates) {
  const sameSuppliers = allSuppliers.filter(s => s._nicheId === cand._nicheId);
  if (sameSuppliers.length > 0) {
    sameSuppliers.sort((a, b) => (a.pricePerUnitUsd ?? Infinity) - (b.pricePerUnitUsd ?? Infinity));
    const cheapest = sameSuppliers[0];
    cand.supplierHint = {
      name: cheapest.supplierName,
      region: cheapest.region,
      ratingPct: cheapest.ratingPct,
    };
    cand._probableSupplyMatchSupplierId = cheapest.id;
    cand._probableLandedCostUsd = cheapest.pricePerUnitUsd != null ? cheapest.pricePerUnitUsd * 2.5 : undefined;
    cand._estimatedMarginUsd = (cand.priceUsd ?? 0) - (cand._probableLandedCostUsd ?? 0);
    cand._estimatedMarginPct = cand.priceUsd ? ((cand._estimatedMarginUsd ?? 0) / cand.priceUsd) : null;
  }
}

// Write the normalized outputs
fs.writeFileSync(path.join(OUT_DIR, 'candidates.json'), JSON.stringify(allCandidates, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'suppliers.json'), JSON.stringify(allSuppliers, null, 2));

summary.endedAt = new Date().toISOString();
summary.totals = {
  amazonCandidates: allCandidates.length,
  taobaoSuppliers: allSuppliers.length,
  nichesPulled: NICHES.length,
};
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

console.log('');
console.log('=== Summary ===');
console.log(`Amazon candidates: ${allCandidates.length}`);
console.log(`Taobao suppliers:  ${allSuppliers.length}`);
console.log(`Niches pulled:     ${NICHES.length}`);
console.log(`Output dir:        ${OUT_DIR}`);
