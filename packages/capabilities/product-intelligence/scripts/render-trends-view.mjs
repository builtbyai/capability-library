#!/usr/bin/env node
/**
 * render-trends-view.mjs — ecommerce research dashboard built from real
 * RapidAPI data + Replicate-generated media + brand-lane policy.
 *
 * Sections per niche:
 *   1. Target audience profile (from config/mjb/brand-lanes.json)
 *   2. Competitive intelligence dashboard (price/rating/saturation charts)
 *   3. Per-product cards w/ ecom-research metrics, generated assets,
 *      supplier match with margin math
 *
 * Per-card metrics computed:
 *   - estimatedMonthlyRevenue (sales_volume × price proxy)
 *   - estimatedProfitPerUnit (retail - landed - amazon fees ~15% + $3 FBA)
 *   - estimatedROAS / break-even CPC
 *   - SEO title score (length, keyword density, has-brand-prefix)
 *   - Competitive saturation tier per niche
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const OUT_HTML = path.join(REPO_ROOT, 'mockups', 'real-trends-view.html');

const candidates = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'candidates.json'), 'utf8'));
const suppliers = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'suppliers.json'), 'utf8'));
const summary = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'summary.json'), 'utf8'));
const genRegistryPath = path.join(DATA_DIR, 'generated', 'index.json');
const genRegistry = fs.existsSync(genRegistryPath) ? JSON.parse(fs.readFileSync(genRegistryPath, 'utf8')) : {};

let brandLanes = { lanes: [] };
const lanesPath = path.join(REPO_ROOT, 'config', 'mjb', 'brand-lanes.json');
if (fs.existsSync(lanesPath)) {
  brandLanes = JSON.parse(fs.readFileSync(lanesPath, 'utf8'));
}
const lanesById = Object.fromEntries(brandLanes.lanes.map(l => [l.laneId, l]));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtUsd = (n) => n == null ? '—' : '$' + Number(n).toFixed(2);
const fmtPct = (n) => n == null ? '—' : (Number(n) * 100).toFixed(0) + '%';
const fmtNum = (n) => n == null ? '—' : Number(n).toLocaleString();

// ===== Per-niche groupings =====
const byNiche = {};
for (const c of candidates) (byNiche[c._nicheId] ||= []).push(c);
const suppliersByNiche = {};
for (const s of suppliers) (suppliersByNiche[s._nicheId] ||= []).push(s);

function nicheLabel(id) {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function laneClass(lane) {
  return { 'mjb-home-finds': 'lane-home', 'mjb-tech-finds': 'lane-tech', 'mjb-everyday-utility': 'lane-utility' }[lane] || 'lane-other';
}

// ===== Brand extraction (first 1-2 words usually = brand) =====
function extractBrand(name) {
  if (!name) return { brand: '(unknown)', slug: 'unknown' };
  // Most Amazon titles start with the brand
  const tokens = name.split(/\s+/);
  // Brand is usually first 1-2 words (uppercase or proper-cased)
  let brandTokens = [];
  for (let i = 0; i < Math.min(3, tokens.length); i++) {
    const t = tokens[i];
    if (/^[A-Z][A-Za-z0-9]*$/.test(t) || /^[A-Z0-9]{2,}$/.test(t)) {
      brandTokens.push(t);
    } else {
      break;
    }
  }
  if (brandTokens.length === 0) brandTokens = [tokens[0]];
  const brand = brandTokens.join(' ');
  return { brand, slug: brand.toLowerCase().replace(/[^a-z0-9]/g, '') };
}

// ===== Sales volume parsing (Amazon returns strings like "1K+ bought in past month") =====
function parseSalesVolume(s) {
  if (!s) return null;
  const str = String(s);
  // Match patterns like "1K+ bought", "10K+ bought", "100+ bought"
  const m = str.match(/(\d+(?:\.\d+)?)\s*([KM]?)\+?\s*bought/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === 'K') n *= 1000;
  if (m[2] === 'M') n *= 1000000;
  return n;
}

// ===== SEO score for product title (proxy) =====
function seoScore(name) {
  if (!name) return 0;
  const wordCount = name.split(/\s+/).length;
  const charCount = name.length;
  // Amazon recommends 150-200 char titles with key features
  const lengthScore = Math.max(0, Math.min(10, (charCount - 50) / 15));
  const hasCount = /\d+\s*(pcs|pack|count|set|piece|pieces)/i.test(name) ? 1 : 0;
  const hasMaterial = /(silicone|stainless|bamboo|plastic|wood|metal|glass)/i.test(name) ? 1 : 0;
  const hasSizeInfo = /(small|large|medium|x?[a-z]*-?large|inch|cm|\d+x\d+)/i.test(name) ? 1 : 0;
  const hasUseCase = /(for|in|with|kitchen|bathroom|car|desk|home)/i.test(name) ? 1 : 0;
  const total = lengthScore + hasCount + hasMaterial + hasSizeInfo + hasUseCase;
  return Math.round(total * 10) / 10;
}

// ===== Ecom-research derived metrics per candidate =====
function enrichCandidate(c) {
  const brand = extractBrand(c.name);
  const salesVolume = parseSalesVolume(c.competitiveContext?.salesVolume);
  const monthlyRevenue = (salesVolume != null && c.priceUsd) ? salesVolume * c.priceUsd : null;
  // Amazon FBA referral fee approx 15%, FBA pick&pack ~$3 for items under 1lb
  const amazonFees = c.priceUsd ? (c.priceUsd * 0.15 + 3) : null;
  const landed = c._probableLandedCostUsd ?? null;
  const profitPerUnit = (c.priceUsd != null && landed != null && amazonFees != null)
    ? c.priceUsd - landed - amazonFees : null;
  const profitMarginPct = (profitPerUnit != null && c.priceUsd) ? profitPerUnit / c.priceUsd : null;
  // Break-even CPC at 3% conversion rate
  const breakEvenCpc = (profitPerUnit != null && profitPerUnit > 0) ? profitPerUnit * 0.03 : null;
  // Review velocity proxy
  const reviewCount = c.reviewSummary?.count ?? 0;
  const monthlyReviewVelocity = reviewCount > 1000 ? Math.round(reviewCount / 24) : Math.round(reviewCount / 6); // rough age guess
  // SEO score
  const seo = seoScore(c.name);
  return {
    ...c,
    _enriched: {
      brand: brand.brand,
      brandSlug: brand.slug,
      salesVolumeParsed: salesVolume,
      monthlyRevenue,
      amazonFees,
      profitPerUnit,
      profitMarginPct,
      breakEvenCpc,
      monthlyReviewVelocity,
      seoScore: seo,
      seoBand: seo >= 9 ? 'A' : seo >= 7 ? 'B' : seo >= 5 ? 'C' : 'D',
    },
  };
}

const enrichedCandidates = candidates.map(enrichCandidate);
const enrichedByNiche = {};
for (const c of enrichedCandidates) (enrichedByNiche[c._nicheId] ||= []).push(c);

// ===== Per-niche analytics =====
function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] != null) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function nicheAnalytics(cands, supps) {
  const prices = cands.map(c => c.priceUsd).filter(n => n != null).sort((a,b)=>a-b);
  const ratings = cands.map(c => c.reviewSummary?.avgRating).filter(n => n != null).sort((a,b)=>a-b);
  const reviewCounts = cands.map(c => c.reviewSummary?.count).filter(n => n != null);
  const reviewMass = reviewCounts.reduce((a,b)=>a+b, 0);
  const bestSellers = cands.filter(c => c.competitiveContext?.isBestSeller).length;
  const amzChoice = cands.filter(c => c.competitiveContext?.isAmazonChoice).length;
  const prime = cands.filter(c => c.competitiveContext?.isPrime).length;
  const monthlyRevenue = cands.map(c => c._enriched.monthlyRevenue).filter(n => n != null);
  const totalRevenueProxy = monthlyRevenue.reduce((a,b)=>a+b, 0);
  // Saturation tier: 0-25% none, 25-50% low, 50-75% medium, 75-100% high
  const competitiveSignals = bestSellers + amzChoice;
  const saturationPct = cands.length ? competitiveSignals / cands.length : 0;
  const saturationTier =
    saturationPct >= 0.7 ? 'EXTREME' :
    saturationPct >= 0.5 ? 'HIGH' :
    saturationPct >= 0.3 ? 'MEDIUM' :
    saturationPct >= 0.1 ? 'LOW' : 'OPEN';
  // Supplier intel
  const supplierCount = supps?.length || 0;
  const supplierPrices = (supps || []).map(s => s.pricePerUnitUsd).filter(n => n != null).sort((a,b)=>a-b);
  const cheapestSupplier = supplierPrices[0] ?? null;
  // Brand diversity
  const brands = new Set(cands.map(c => c._enriched.brandSlug));
  return {
    n: cands.length,
    price: {
      min: prices[0] ?? null,
      max: prices[prices.length - 1] ?? null,
      median: quantile(prices, 0.5),
      mean: prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : null,
      q1: quantile(prices, 0.25),
      q3: quantile(prices, 0.75),
      all: prices,
    },
    rating: {
      min: ratings[0] ?? null,
      max: ratings[ratings.length - 1] ?? null,
      median: quantile(ratings, 0.5),
      mean: ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null,
      all: ratings,
    },
    reviewMass,
    bestSellers, amzChoice, prime,
    saturationPct, saturationTier,
    monthlyRevenueTotal: totalRevenueProxy,
    monthlyRevenueAvg: monthlyRevenue.length ? totalRevenueProxy / monthlyRevenue.length : 0,
    supplierCount,
    cheapestSupplierUsd: cheapestSupplier,
    brandDiversity: brands.size,
    distinctBrandRatio: cands.length ? brands.size / cands.length : 0,
  };
}

// ===== SVG bar chart for distribution =====
function svgPriceDist(prices, width = 240, height = 80) {
  if (!prices || prices.length === 0) return '<div class="empty">no data</div>';
  const bins = 8;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = (max - min) || 1;
  const counts = new Array(bins).fill(0);
  for (const p of prices) {
    const idx = Math.min(bins - 1, Math.floor(((p - min) / range) * bins));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts);
  const barW = width / bins;
  const bars = counts.map((c, i) => {
    const h = (c / maxCount) * (height - 20);
    return `<rect x="${i * barW + 1}" y="${height - h - 10}" width="${barW - 2}" height="${h}" fill="#6366f1" rx="2"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
    ${bars}
    <text x="0" y="${height - 1}" font-size="9" fill="#94a0c0">$${min.toFixed(0)}</text>
    <text x="${width - 30}" y="${height - 1}" font-size="9" fill="#94a0c0" text-anchor="end">$${max.toFixed(0)}</text>
  </svg>`;
}

function svgRatingDist(ratings, width = 240, height = 80) {
  if (!ratings || ratings.length === 0) return '<div class="empty">no data</div>';
  // Bin by 0.1 from 3.5 to 5.0
  const minR = 3.5, maxR = 5.0, step = 0.1;
  const bins = Math.round((maxR - minR) / step);
  const counts = new Array(bins).fill(0);
  for (const r of ratings) {
    if (r < minR || r > maxR) continue;
    const idx = Math.min(bins - 1, Math.floor((r - minR) / step));
    counts[idx]++;
  }
  const maxCount = Math.max(1, ...counts);
  const barW = width / bins;
  const bars = counts.map((c, i) => {
    const h = (c / maxCount) * (height - 20);
    const r = minR + i * step;
    const color = r >= 4.5 ? '#10b981' : r >= 4.0 ? '#f59e0b' : '#ef4444';
    return `<rect x="${i * barW + 0.5}" y="${height - h - 10}" width="${barW - 1}" height="${h}" fill="${color}" rx="1"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
    ${bars}
    <text x="0" y="${height - 1}" font-size="9" fill="#94a0c0">${minR.toFixed(1)}★</text>
    <text x="${width - 20}" y="${height - 1}" font-size="9" fill="#94a0c0" text-anchor="end">${maxR.toFixed(1)}★</text>
  </svg>`;
}

function svgMarginChart(retail, landed, fees, profit, width = 240, height = 90) {
  if (retail == null || landed == null) return '<div class="empty">need supplier data</div>';
  const total = retail;
  const segs = [
    { label: 'Supply', val: landed, color: '#ff4400' },
    { label: 'Fees', val: fees ?? 0, color: '#f59e0b' },
    { label: 'Profit', val: Math.max(0, profit ?? 0), color: profit > 0 ? '#10b981' : '#ef4444' },
  ];
  let x = 0;
  const barH = 30;
  const rects = segs.map(s => {
    const w = (s.val / total) * width;
    const r = `<rect x="${x}" y="20" width="${w - 1}" height="${barH}" fill="${s.color}" rx="3"/>
               <text x="${x + w/2}" y="38" font-size="10" fill="white" font-weight="700" text-anchor="middle">${fmtUsd(s.val).replace('$','')}</text>`;
    x += w;
    return r;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">
    ${rects}
    <text x="0" y="15" font-size="10" fill="#94a0c0">Retail ${fmtUsd(retail)}</text>
    <text x="${width}" y="15" font-size="10" fill="${profit > 0 ? '#10b981' : '#ef4444'}" text-anchor="end" font-weight="700">${profit > 0 ? '+' : ''}${fmtUsd(profit)} (${fmtPct(profit/retail)})</text>
    <text x="0" y="${height - 5}" font-size="9" fill="#ff4400">▆ Supply</text>
    <text x="60" y="${height - 5}" font-size="9" fill="#f59e0b">▆ Amz fees</text>
    <text x="135" y="${height - 5}" font-size="9" fill="${profit > 0 ? '#10b981' : '#ef4444'}">▆ Profit</text>
  </svg>`;
}

// ===== Lane / target audience block =====
function renderLaneBlock(laneId) {
  const lane = lanesById[laneId];
  if (!lane) return '';
  const cls = laneClass(laneId);
  return `
    <div class="lane-block">
      <div class="lane-head">
        <span class="pill ${cls}">${esc(lane.displayName)}</span>
        <span class="lane-mode">${esc(lane.approvalMode || lane.approvalMode)} approval</span>
      </div>
      <div class="lane-audience"><strong>Audience:</strong> ${esc(lane.audience)}</div>
      <div class="lane-meta-grid">
        <div><span class="lk">Tone</span><span class="lv">${esc(lane.tone)}</span></div>
        <div><span class="lk">Sweet spot</span><span class="lv">$${lane.priceBand?.sweetSpot} (${lane.priceBand?.min}-${lane.priceBand?.max})</span></div>
        <div><span class="lk">Categories</span><span class="lv">${esc((lane.primaryCategories || []).join(', '))}</span></div>
        <div><span class="lk">Blocked</span><span class="lv blocked">${esc((lane.blockedCategories || []).join(', '))}</span></div>
      </div>
    </div>
  `;
}

// ===== Niche analytics dashboard =====
function renderAnalyticsDash(an) {
  return `
    <div class="analytics-dash">
      <div class="analytics-tile">
        <div class="tile-head">Price spread</div>
        ${svgPriceDist(an.price.all)}
        <div class="tile-stats">min ${fmtUsd(an.price.min)} · med ${fmtUsd(an.price.median)} · max ${fmtUsd(an.price.max)}</div>
      </div>
      <div class="analytics-tile">
        <div class="tile-head">Rating distribution</div>
        ${svgRatingDist(an.rating.all)}
        <div class="tile-stats">avg ${an.rating.mean?.toFixed(2) ?? '—'}★ · median ${an.rating.median?.toFixed(2) ?? '—'}★</div>
      </div>
      <div class="analytics-tile">
        <div class="tile-head">Competitive saturation</div>
        <div class="sat-tier sat-${an.saturationTier.toLowerCase()}">${an.saturationTier}</div>
        <div class="tile-stats">${an.bestSellers} best · ${an.amzChoice} choice · ${an.prime} prime</div>
        <div class="tile-stats">${(an.saturationPct * 100).toFixed(0)}% have competitive flags</div>
      </div>
      <div class="analytics-tile">
        <div class="tile-head">Market size proxy</div>
        <div class="market-num">${fmtUsd(an.monthlyRevenueTotal).split('.')[0]}<span class="market-sub">/mo top-${an.n}</span></div>
        <div class="tile-stats">${fmtNum(an.reviewMass)} reviews total · ${an.brandDiversity} distinct brands</div>
        <div class="tile-stats">Brand diversity: ${(an.distinctBrandRatio * 100).toFixed(0)}%</div>
      </div>
      <div class="analytics-tile">
        <div class="tile-head">Supplier intel (Taobao)</div>
        ${an.supplierCount > 0 ? `
          <div class="market-num">${an.supplierCount}<span class="market-sub">candidates</span></div>
          <div class="tile-stats">Cheapest: ${fmtUsd(an.cheapestSupplierUsd)}</div>
        ` : '<div class="empty">no suppliers matched</div>'}
      </div>
    </div>
  `;
}

// ===== Per-product card =====
function pickAmazonHero(c) { return c.mediaRefs?.[0]?.sourceUrl || ''; }

function renderProductCard(c) {
  const e = c._enriched;
  const gen = genRegistry[c.id];
  const genAssets = gen?.assets || [];
  const heroAsset = genAssets.find(a => a.kind === 'hero');
  const lifestyleAsset = genAssets.find(a => a.kind === 'lifestyle');
  const baAsset = genAssets.find(a => a.kind === 'before-after');
  const hasGen = genAssets.length > 0;
  const fileFor = (a) => a ? a.file.replace(/^mockups\//, '') : null;
  // Match a supplier from same niche
  const matchSupp = (suppliersByNiche[c._nicheId] || []).find(s => s.id === c._probableSupplyMatchSupplierId) || (suppliersByNiche[c._nicheId] || [])[0];

  return `
  <article class="prod-card">
    <header class="prod-head">
      <div class="prod-photo"><img src="${esc(pickAmazonHero(c))}" alt="${esc(c.name)}"></div>
      <div class="prod-meta-col">
        <div class="brand-row">
          <span class="brand-chip">${esc(e.brand)}</span>
          <span class="asin mono">${esc(c.sourceId)}</span>
        </div>
        <h3 class="prod-name" title="${esc(c.name)}">${esc(c.name)}</h3>
        <div class="prod-price-row">
          <span class="price-big">${fmtUsd(c.priceUsd)}</span>
          ${c.reviewSummary ? `<span class="rating-big">★ ${c.reviewSummary.avgRating.toFixed(1)}</span><span class="review-count">(${fmtNum(c.reviewSummary.count)})</span>` : ''}
        </div>
        <div class="badge-row">
          ${c.competitiveContext?.isBestSeller ? '<span class="pill pill-best">Best Seller</span>' : ''}
          ${c.competitiveContext?.isAmazonChoice ? '<span class="pill pill-choice">Amazon\'s Choice</span>' : ''}
          ${c.competitiveContext?.isPrime ? '<span class="pill pill-prime">Prime</span>' : ''}
          ${c.competitiveContext?.salesVolume ? `<span class="pill pill-sales">${esc(c.competitiveContext.salesVolume)}</span>` : ''}
        </div>
        <a href="${esc(c.urls?.[0] || '#')}" target="_blank" class="src-link">amazon.com/dp/${esc(c.sourceId)} →</a>
      </div>
    </header>

    <section class="ecom-research">
      <div class="er-head">📊 Ecom-research metrics</div>
      <div class="er-grid">
        <div class="er-cell">
          <div class="er-label">Est. monthly revenue</div>
          <div class="er-val ${e.monthlyRevenue ? 'good' : 'na'}">${e.monthlyRevenue ? fmtUsd(e.monthlyRevenue).split('.')[0] : '—'}</div>
          <div class="er-sub">${e.salesVolumeParsed ? fmtNum(e.salesVolumeParsed) + ' units/mo × ' + fmtUsd(c.priceUsd) : 'no sales-volume signal'}</div>
        </div>
        <div class="er-cell">
          <div class="er-label">Profit / unit (FBA)</div>
          <div class="er-val ${e.profitPerUnit > 0 ? 'good' : e.profitPerUnit != null ? 'bad' : 'na'}">${e.profitPerUnit != null ? (e.profitPerUnit > 0 ? '+' : '') + fmtUsd(e.profitPerUnit) : '—'}</div>
          <div class="er-sub">retail − landed (${fmtUsd(c._probableLandedCostUsd)}) − Amz fees (${fmtUsd(e.amazonFees)})</div>
        </div>
        <div class="er-cell">
          <div class="er-label">Margin %</div>
          <div class="er-val ${e.profitMarginPct > 0.2 ? 'good' : e.profitMarginPct > 0 ? 'warn' : 'bad'}">${fmtPct(e.profitMarginPct)}</div>
          <div class="er-sub">break-even CPC: ${e.breakEvenCpc ? fmtUsd(e.breakEvenCpc) : '—'} @ 3% CR</div>
        </div>
        <div class="er-cell">
          <div class="er-label">SEO title</div>
          <div class="er-val seo-${e.seoBand.toLowerCase()}">${e.seoScore.toFixed(1)}/10 <span class="seo-band">${e.seoBand}</span></div>
          <div class="er-sub">${c.name.length} chars · ${c.name.split(/\s+/).length} words</div>
        </div>
        <div class="er-cell">
          <div class="er-label">Review velocity</div>
          <div class="er-val">${fmtNum(e.monthlyReviewVelocity)}<span class="er-sub-inline">/mo</span></div>
          <div class="er-sub">total ${fmtNum(c.reviewSummary?.count ?? 0)} (rough age estimate)</div>
        </div>
        <div class="er-cell">
          <div class="er-label">Domain</div>
          <div class="er-val mono small-mono">amazon.com</div>
          <div class="er-sub">→ ASIN page · category: ${esc(c._nicheId)}</div>
        </div>
      </div>
      <div class="margin-chart">
        ${svgMarginChart(c.priceUsd, c._probableLandedCostUsd, e.amazonFees, e.profitPerUnit)}
      </div>
    </section>

    ${hasGen ? `
      <section class="gen-section">
        <div class="gen-head">✨ Generated assets · ${genAssets.length} from flux-1.1-pro-ultra ($${(genAssets.length * 0.06).toFixed(2)})</div>
        <div class="gen-grid">
          ${heroAsset ? `<a href="${esc(fileFor(heroAsset))}" target="_blank" class="gen-tile"><img src="${esc(fileFor(heroAsset))}"><span class="gen-label">HERO</span></a>` : ''}
          ${lifestyleAsset ? `<a href="${esc(fileFor(lifestyleAsset))}" target="_blank" class="gen-tile"><img src="${esc(fileFor(lifestyleAsset))}"><span class="gen-label">LIFESTYLE</span></a>` : ''}
          ${baAsset ? `<a href="${esc(fileFor(baAsset))}" target="_blank" class="gen-tile gen-video"><img src="${esc(fileFor(baAsset))}"><span class="gen-label">BEFORE/AFTER</span></a>` : ''}
        </div>
      </section>
    ` : `
      <section class="gen-section gen-empty">
        <div class="gen-head gen-empty-head">No generated media yet</div>
        <div class="gen-empty-msg">run: <code>node packages/capabilities/media-generation/scripts/batch-generate-from-candidates.mjs --top N</code></div>
      </section>
    `}

    ${matchSupp ? `
      <section class="supplier-section">
        <div class="supplier-head">🏭 Supplier match · Taobao DataHub</div>
        <div class="supplier-content">
          <div class="supplier-photo">${matchSupp._image ? `<img src="${esc(matchSupp._image)}">` : '<div class="ph">📦</div>'}</div>
          <div class="supplier-body">
            <div class="supplier-name">${esc((matchSupp._productName || '').slice(0, 100))}</div>
            <div class="supplier-shop">${esc(matchSupp.supplierName)} <span class="supplier-region">· ${esc(matchSupp._shippingFrom || matchSupp.region)}</span></div>
            <div class="supplier-price-row">
              <span class="sup-pill">¥${matchSupp._priceOriginal?.value ?? '—'} CNY</span>
              <span class="sup-pill sup-pill-usd">≈ ${fmtUsd(matchSupp.pricePerUnitUsd)} USD</span>
              ${matchSupp._sales && matchSupp._sales !== '0' ? `<span class="sup-pill sup-pill-sales">${esc(matchSupp._sales)} sold</span>` : ''}
              <span class="sup-pill sup-pill-conf">match conf: ${(matchSupp.productMatchConfidence * 100).toFixed(0)}%</span>
            </div>
            <a href="${esc(matchSupp.urls?.[0] || '#')}" target="_blank" class="src-link">item.taobao.com →</a>
          </div>
        </div>
      </section>
    ` : ''}
  </article>
  `;
}

// ===== Niche section =====
function renderNicheSection(nicheId, cands, supps) {
  const an = nicheAnalytics(cands, supps);
  const lane = cands[0]?._lane;
  return `
  <section class="niche-section">
    <header class="niche-head">
      <div>
        <h2>${nicheLabel(nicheId)}</h2>
        <div class="niche-sub">${cands.length} Amazon candidates · ${supps?.length || 0} Taobao supplier matches · query: "${esc(summary.niches.find(n=>n.id===nicheId)?.query || '')}"</div>
      </div>
    </header>
    ${renderLaneBlock(lane)}
    ${renderAnalyticsDash(an)}
    <div class="prod-card-list">
      ${cands.map(renderProductCard).join('')}
    </div>
  </section>
  `;
}

// ===== Top-level summary =====
const totalGen = Object.values(genRegistry).reduce((sum, g) => sum + (g.assets?.length || 0), 0);
const totalGenCostEstimate = totalGen * 0.06;
const totalEstRevenue = enrichedCandidates.reduce((s, c) => s + (c._enriched.monthlyRevenue || 0), 0);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MJB Trends — Deep Ecommerce Research</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0a0e1a;--bg-card:#131829;--bg-card-2:#1a2138;--border:#232a44;
    --text:#e8ecf5;--text-dim:#94a0c0;--text-faint:#5a6585;
    --accent:#6366f1;--accent-dim:#4f46e5;
    --success:#10b981;--warn:#f59e0b;--danger:#ef4444;
    --amazon:#ff9900;--taobao:#ff4400;
    --lane-home:#06b6d4;--lane-tech:#8b5cf6;--lane-utility:#f59e0b;
  }
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;padding:24px;min-height:100vh}
  .topbar{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid var(--border)}
  .topbar h1{font-size:22px;font-weight:800}
  .top-sub{font-size:13px;color:var(--text-dim);margin-top:4px}
  .top-stats{display:flex;gap:18px;align-items:flex-start}
  .top-stat{text-align:right}
  .top-stat-num{font-size:18px;font-weight:800;color:var(--accent)}
  .top-stat-lbl{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px}
  .pill{padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(255,255,255,.05);color:var(--text-dim);border:1px solid var(--border);display:inline-block}
  .pill.mono{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--text-faint)}
  .pill-best{background:rgba(245,158,11,.15);color:var(--warn);border-color:rgba(245,158,11,.3)}
  .pill-choice{background:rgba(99,102,241,.15);color:var(--accent);border-color:rgba(99,102,241,.3)}
  .pill-prime{background:rgba(34,197,94,.12);color:#22c55e;border-color:rgba(34,197,94,.25)}
  .pill-sales{background:rgba(16,185,129,.1);color:var(--success);border-color:rgba(16,185,129,.2)}
  .lane-home{background:rgba(6,182,212,.15);color:var(--lane-home);border-color:rgba(6,182,212,.3)}
  .lane-tech{background:rgba(139,92,246,.15);color:var(--lane-tech);border-color:rgba(139,92,246,.3)}
  .lane-utility{background:rgba(245,158,11,.15);color:var(--lane-utility);border-color:rgba(245,158,11,.3)}

  .niche-section{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:32px}
  .niche-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)}
  .niche-head h2{font-size:22px;font-weight:800}
  .niche-sub{font-size:12px;color:var(--text-dim);margin-top:4px}

  /* Lane / audience block */
  .lane-block{background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:16px;margin-bottom:16px}
  .lane-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
  .lane-mode{font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;font-weight:600}
  .lane-audience{font-size:14px;color:var(--text);margin-bottom:12px;line-height:1.5}
  .lane-audience strong{color:var(--accent)}
  .lane-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px}
  .lane-meta-grid > div{display:flex;flex-direction:column;gap:2px}
  .lk{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px}
  .lv{color:var(--text);font-weight:500}
  .lv.blocked{color:var(--danger);font-size:11px}

  /* Analytics dashboard */
  .analytics-dash{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:24px}
  .analytics-tile{background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:8px;padding:14px}
  .tile-head{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:10px}
  .tile-stats{font-size:11px;color:var(--text-dim);margin-top:6px;line-height:1.5}
  .sat-tier{font-size:24px;font-weight:800;text-align:center;padding:8px 0}
  .sat-extreme{color:var(--danger)}
  .sat-high{color:var(--warn)}
  .sat-medium{color:var(--accent)}
  .sat-low{color:var(--success)}
  .sat-open{color:#22c55e}
  .market-num{font-size:24px;font-weight:800;color:var(--accent)}
  .market-sub{font-size:11px;color:var(--text-faint);margin-left:6px;font-weight:400}
  .empty{font-size:11px;color:var(--text-faint);text-align:center;padding:12px}

  /* Product card */
  .prod-card-list{display:flex;flex-direction:column;gap:20px}
  .prod-card{background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:14px;overflow:hidden}
  .prod-head{display:grid;grid-template-columns:180px 1fr;gap:18px;padding:18px;background:linear-gradient(180deg,rgba(99,102,241,.04),transparent)}
  .prod-photo{aspect-ratio:1;background:white;border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .prod-photo img{width:100%;height:100%;object-fit:contain;padding:12px}
  .prod-meta-col{display:flex;flex-direction:column;gap:6px;min-width:0}
  .brand-row{display:flex;justify-content:space-between;align-items:center}
  .brand-chip{background:linear-gradient(135deg,#ff9900,#ffb84d);color:#0a0e1a;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
  .asin{color:var(--text-faint)}
  .prod-name{font-size:15px;font-weight:600;line-height:1.4;margin:2px 0}
  .prod-price-row{display:flex;align-items:baseline;gap:10px;margin-top:4px}
  .price-big{font-size:26px;font-weight:800;color:var(--text)}
  .rating-big{font-size:15px;color:var(--warn);font-weight:700}
  .review-count{font-size:12px;color:var(--text-dim)}
  .badge-row{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
  .src-link{display:inline-block;margin-top:8px;font-size:11px;color:var(--accent);text-decoration:none;font-weight:600;font-family:"JetBrains Mono",monospace}
  .src-link:hover{text-decoration:underline}

  /* Ecom research */
  .ecom-research{padding:18px;background:rgba(99,102,241,.03);border-top:1px solid var(--border)}
  .er-head{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent);margin-bottom:14px}
  .er-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:16px}
  .er-cell{background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:8px;padding:12px}
  .er-label{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .er-val{font-size:18px;font-weight:800}
  .er-val.good{color:var(--success)}
  .er-val.warn{color:var(--warn)}
  .er-val.bad{color:var(--danger)}
  .er-val.na{color:var(--text-faint);font-weight:600;font-size:16px}
  .er-val.seo-a{color:var(--success)}
  .er-val.seo-b{color:#22c55e}
  .er-val.seo-c{color:var(--warn)}
  .er-val.seo-d{color:var(--danger)}
  .seo-band{font-size:11px;background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;margin-left:4px}
  .er-sub{font-size:10px;color:var(--text-dim);margin-top:4px;line-height:1.3}
  .er-sub-inline{font-size:11px;color:var(--text-dim);font-weight:500;margin-left:3px}
  .small-mono{font-family:"JetBrains Mono",monospace;font-size:13px}

  .margin-chart{background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:6px}

  /* Generated assets section */
  .gen-section{padding:16px 18px;background:linear-gradient(180deg,rgba(99,102,241,.08),rgba(99,102,241,.02));border-top:1px solid rgba(99,102,241,.25)}
  .gen-head{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent);margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .gen-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .gen-tile{position:relative;aspect-ratio:9/16;border-radius:8px;overflow:hidden;display:block;background:#0a0e1a;border:1px solid rgba(99,102,241,.4)}
  .gen-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .2s}
  .gen-tile:hover img{transform:scale(1.04)}
  .gen-label{position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,.8);color:white;font-size:9px;padding:3px 7px;border-radius:4px;font-weight:700;letter-spacing:.5px;backdrop-filter:blur(4px)}
  .gen-video::after{content:"▶";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.9);color:#000;display:flex;align-items:center;justify-content:center;font-size:14px;padding-left:3px;box-shadow:0 4px 12px rgba(0,0,0,.5)}
  .gen-empty{background:rgba(255,255,255,.01);border-top-color:var(--border)}
  .gen-empty-head{color:var(--text-faint)}
  .gen-empty-msg{font-size:11px;color:var(--text-faint)}
  .gen-empty-msg code{background:rgba(0,0,0,.4);padding:2px 6px;border-radius:3px;color:var(--accent);font-size:11px}

  /* Supplier section */
  .supplier-section{padding:18px;background:rgba(255,68,0,.04);border-top:1px solid rgba(255,68,0,.2)}
  .supplier-head{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#ff8855;margin-bottom:12px}
  .supplier-content{display:grid;grid-template-columns:100px 1fr;gap:14px}
  .supplier-photo{aspect-ratio:1;background:white;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .supplier-photo img{width:100%;height:100%;object-fit:contain;padding:8px}
  .supplier-photo .ph{font-size:36px}
  .supplier-body{display:flex;flex-direction:column;gap:6px;min-width:0}
  .supplier-name{font-size:13px;font-weight:600;line-height:1.4}
  .supplier-shop{font-size:12px;color:var(--text-dim)}
  .supplier-region{color:var(--text-faint)}
  .supplier-price-row{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
  .sup-pill{font-size:11px;padding:3px 9px;border-radius:5px;background:rgba(255,68,0,.15);color:#ff8855;border:1px solid rgba(255,68,0,.25);font-weight:600}
  .sup-pill-usd{background:rgba(16,185,129,.15);color:var(--success);border-color:rgba(16,185,129,.3)}
  .sup-pill-sales{background:rgba(255,255,255,.05);color:var(--text-dim);border-color:var(--border)}
  .sup-pill-conf{background:rgba(99,102,241,.1);color:var(--accent);border-color:rgba(99,102,241,.2);font-family:"JetBrains Mono",monospace;font-size:10px}

  .footer{margin-top:32px;padding-top:18px;border-top:1px solid var(--border);font-size:11px;color:var(--text-faint);text-align:center;line-height:1.7}
  .footer .mono{font-family:"JetBrains Mono",monospace}
  .footer a{color:var(--accent);text-decoration:none}
</style>
</head>
<body>

<div class="topbar">
  <div>
    <h1>MJB Trends — Deep Ecommerce Research</h1>
    <div class="top-sub">Real RapidAPI pull · Real-Time Amazon Data + Taobao DataHub · Replicate flux-1.1-pro-ultra · Pulled ${new Date(summary.startedAt).toLocaleString()}</div>
  </div>
  <div class="top-stats">
    <div class="top-stat"><div class="top-stat-num">${candidates.length}</div><div class="top-stat-lbl">Amazon candidates</div></div>
    <div class="top-stat"><div class="top-stat-num">${suppliers.length}</div><div class="top-stat-lbl">Taobao suppliers</div></div>
    <div class="top-stat"><div class="top-stat-num">${totalGen}</div><div class="top-stat-lbl">Gen assets</div></div>
    <div class="top-stat"><div class="top-stat-num">$${totalGenCostEstimate.toFixed(2)}</div><div class="top-stat-lbl">Gen spend</div></div>
    <div class="top-stat"><div class="top-stat-num">${fmtUsd(totalEstRevenue).split('.')[0]}</div><div class="top-stat-lbl">Est. monthly market</div></div>
  </div>
</div>

${Object.keys(enrichedByNiche).map(nicheId => renderNicheSection(nicheId, enrichedByNiche[nicheId], suppliersByNiche[nicheId] || [])).join('')}

<div class="footer">
  Live data · <span class="mono">real-time-amazon-data.p.rapidapi.com</span> + <span class="mono">taobao-datahub.p.rapidapi.com</span> + <span class="mono">api.replicate.com black-forest-labs/flux-1.1-pro-ultra</span><br>
  Brand-lane audience metadata from <span class="mono">config/mjb/brand-lanes.json</span> · Ecom-research metrics computed inline (no enrichment API calls)<br>
  Refresh: <span class="mono">node packages/capabilities/product-intelligence/scripts/pull-trends.mjs &amp;&amp; node packages/capabilities/media-generation/scripts/batch-generate-from-candidates.mjs --top 5 &amp;&amp; node packages/capabilities/product-intelligence/scripts/render-trends-view.mjs</span>
</div>

</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html);
console.log(`wrote ${(html.length / 1024).toFixed(1)}KB to ${OUT_HTML}`);
console.log(`niches: ${Object.keys(enrichedByNiche).length}, candidates: ${candidates.length}, suppliers: ${suppliers.length}, generated: ${totalGen} assets ($${totalGenCostEstimate.toFixed(2)})`);
