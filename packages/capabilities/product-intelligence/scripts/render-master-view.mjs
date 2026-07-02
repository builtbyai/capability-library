#!/usr/bin/env node
/**
 * render-master-view.mjs — the ONE editorial-style HTML view that
 * integrates everything the pipeline produces:
 *   - Real Amazon + Taobao trends data
 *   - LLM research (trends deep-dive, UGC playbook, shop inspiration)
 *   - Design concepts side-by-side (OpenAI vs Gemini)
 *   - Generated product media (per-candidate hero/lifestyle/before-after)
 *   - Generated logos (per-lane initial + wordmark variants)
 *   - Codex shop previews (when present)
 *   - Interactive toolbar: tabs / search / sort / filters / regen / view switcher
 *
 * Design system mandated by the user — see memory:
 *   feedback_mjb_design_system.md
 * Cream #f4efe6 + terracotta #c0492a + Newsreader serif + Archivo + JetBrains Mono.
 * NEVER a dark dashboard. This is the client-facing master view.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const RESEARCH_DIR = path.join(DATA_DIR, 'research');
const GENERATED_DIR = path.join(DATA_DIR, 'generated');
const OUT_HTML = path.join(REPO_ROOT, 'mockups', 'mjb-master-view.html');

function safeJson(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const candidates = safeJson(path.join(DATA_DIR, 'candidates.json')) || [];
const suppliers = safeJson(path.join(DATA_DIR, 'suppliers.json')) || [];
const summary = safeJson(path.join(DATA_DIR, 'summary.json')) || { niches: [] };
const trendsRes = safeJson(path.join(RESEARCH_DIR, 'trends-deep-dive.json'));
const ugcRes = safeJson(path.join(RESEARCH_DIR, 'ugc-best-practices.json'));
const inspRes = safeJson(path.join(RESEARCH_DIR, 'shop-design-inspiration.json'));
const concOAI = safeJson(path.join(RESEARCH_DIR, 'design-concepts-openai.json'));
const concGEM = safeJson(path.join(RESEARCH_DIR, 'design-concepts-gemini.json'));
const trendsGEM = safeJson(path.join(RESEARCH_DIR, 'trends-deep-dive-gemini.json'));
const ugcGEM = safeJson(path.join(RESEARCH_DIR, 'ugc-best-practices-gemini.json'));
const inspGEM = safeJson(path.join(RESEARCH_DIR, 'shop-design-inspiration-gemini.json'));
const genIndex = safeJson(path.join(GENERATED_DIR, 'index.json')) || {};
const logoIndex = safeJson(path.join(GENERATED_DIR, 'logos', 'index.json')) || {};
const shopLogoIndex = safeJson(path.join(GENERATED_DIR, 'shop-logos', 'index.json')) || {};
const shopConcepts = {};
const conceptsDir = path.join(GENERATED_DIR, 'shop-concepts');
if (fs.existsSync(conceptsDir)) {
  for (const f of fs.readdirSync(conceptsDir).filter(f => f.endsWith('.json'))) {
    const nicheId = f.replace('.json', '');
    const concept = safeJson(path.join(conceptsDir, f));
    if (concept) shopConcepts[nicheId] = concept;
  }
}
const brandLanes = safeJson(path.join(REPO_ROOT, 'config', 'mjb', 'brand-lanes.json')) || { lanes: [] };
const scorecard = safeJson(path.join(REPO_ROOT, 'config', 'mjb', 'product-scorecard.json')) || {};

const lanes = brandLanes.lanes || [];
const lanesById = Object.fromEntries(lanes.map(l => [l.laneId, l]));

const shopPreviewsDir = path.join(REPO_ROOT, 'mockups', 'shop-previews');
const shopPreviews = fs.existsSync(shopPreviewsDir) ? fs.readdirSync(shopPreviewsDir).filter(f => f.endsWith('.html')) : [];

// ---- Helpers ----
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtUsd = (n, dec = 0) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: dec });
const fmtPct = (n) => n == null ? '—' : (Number(n) * 100).toFixed(0) + '%';
const fmtNum = (n) => n == null ? '—' : Number(n).toLocaleString();
const nicheLabel = (id) => id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
const initial = (s) => (s || '?').trim().charAt(0).toUpperCase();
const shortName = (s) => String(s || '').split(',')[0].split('(')[0].split('-')[0].trim();

// ---- Derived per-candidate metrics ----
function parseSalesVolume(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+(?:\.\d+)?)\s*([KM]?)\+?\s*bought/i);
  if (!m) return null;
  let n = parseFloat(m[1]); if (m[2] === 'K') n *= 1000; if (m[2] === 'M') n *= 1000000;
  return n;
}

function extractBrand(name) {
  if (!name) return '(unknown)';
  const tokens = name.split(/\s+/);
  let out = [];
  for (let i = 0; i < Math.min(3, tokens.length); i++) {
    if (/^[A-Z][A-Za-z0-9]*$/.test(tokens[i]) || /^[A-Z0-9]{2,}$/.test(tokens[i])) out.push(tokens[i]);
    else break;
  }
  return out.length ? out.join(' ') : tokens[0];
}

function enrich(c) {
  const salesVol = parseSalesVolume(c.competitiveContext?.salesVolume);
  const monthlyRev = (salesVol && c.priceUsd) ? salesVol * c.priceUsd : null;
  const fees = c.priceUsd ? c.priceUsd * 0.15 + 3 : null;
  const landed = c._probableLandedCostUsd ?? null;
  const profitU = (c.priceUsd != null && landed != null && fees != null) ? c.priceUsd - landed - fees : null;
  const marginPct = (profitU != null && c.priceUsd) ? profitU / c.priceUsd : null;
  const markup = (c.priceUsd && landed) ? c.priceUsd / landed : null;
  const reviewC = c.reviewSummary?.count ?? 0;
  const rating = c.reviewSummary?.avgRating ?? 0;
  // Composite score 0-100
  let comp = 0;
  comp += Math.max(0, Math.min(40, (marginPct ?? 0) * 100));
  comp += rating * 8;
  comp += Math.min(20, reviewC / 1000);
  if (c.competitiveContext?.isBestSeller) comp += 15;
  if (c.competitiveContext?.isAmazonChoice) comp += 10;
  if (c.competitiveContext?.isPrime) comp += 3;
  comp = Math.round(Math.max(0, Math.min(100, comp)));
  let tier, tierColor, tierBg;
  if (comp >= 75) { tier = 'STRONG'; tierColor = '#2c7a3e'; tierBg = '#dceede'; }
  else if (comp >= 55) { tier = 'SOLID'; tierColor = '#23201a'; tierBg = '#ece5d7'; }
  else if (comp >= 30) { tier = 'WATCH'; tierColor = '#8a5a00'; tierBg = '#f4e4c4'; }
  else { tier = 'PASS'; tierColor = '#9b2d1b'; tierBg = '#f0d3cc'; }
  return {
    ...c,
    _brand: extractBrand(c.name),
    _salesVol: salesVol,
    _monthlyRev: monthlyRev,
    _fees: fees,
    _profitU: profitU,
    _marginPct: marginPct,
    _markup: markup,
    _reviewVelocity: reviewC > 1000 ? Math.round(reviewC / 24) : Math.round(reviewC / 6),
    _comp: comp,
    _tier: tier,
    _tierColor: tierColor,
    _tierBg: tierBg,
  };
}

const enriched = candidates.map(enrich);
const byNiche = {};
for (const c of enriched) (byNiche[c._nicheId] ||= []).push(c);
const suppliersByNiche = {};
for (const s of suppliers) (suppliersByNiche[s._nicheId] ||= []).push(s);

// ---- Aggregate KPIs ----
const kpis = (() => {
  const profitable = enriched.filter(c => (c._marginPct ?? -1) > 0).length;
  const medianMargin = (() => {
    const ms = enriched.map(c => c._marginPct).filter(n => n != null).sort((a, b) => a - b);
    return ms.length ? ms[Math.floor(ms.length / 2)] : null;
  })();
  const totalMarket = enriched.reduce((s, c) => s + (c._monthlyRev || 0), 0);
  const totalGen = Object.values(genIndex).reduce((s, g) => s + (g.assets?.length || 0), 0);
  const niches = Object.keys(byNiche).length;
  return [
    { num: String(enriched.length), lbl: 'Amazon candidates', color: '#23201a' },
    { num: String(niches), lbl: 'Categories', color: '#23201a' },
    { num: String(suppliers.length), lbl: 'Taobao suppliers', color: '#23201a' },
    { num: medianMargin != null ? fmtPct(medianMargin) : '—', lbl: 'Median margin', color: (medianMargin ?? 0) >= 0 ? '#2c7a3e' : '#9b2d1b' },
    { num: `${profitable}/${enriched.length}`, lbl: 'Profitable SKUs', color: '#2c7a3e' },
    { num: totalMarket > 1_000_000 ? `$${(totalMarket/1_000_000).toFixed(2)}M` : fmtUsd(totalMarket), lbl: 'Est. monthly market', color: '#c0492a' },
    { num: String(totalGen), lbl: 'Generated assets', color: '#c0492a' },
  ];
})();

// ---- Lane brand-circle color ----
const laneCircleColor = (laneId) => ({
  'mjb-home-finds':       { bg: '#dceede', fg: '#2c7a3e' },
  'mjb-tech-finds':       { bg: '#e6e3f0', fg: '#5a4e8f' },
  'mjb-everyday-utility': { bg: '#f4e4c4', fg: '#8a5a00' },
}[laneId] || { bg: '#ece5d7', fg: '#23201a' });

const lanePillColor = (laneId) => ({
  'mjb-home-finds':       { bg: '#dceede', fg: '#2c7a3e', border: '#b9d6bc' },
  'mjb-tech-finds':       { bg: '#e6e3f0', fg: '#5a4e8f', border: '#cac3df' },
  'mjb-everyday-utility': { bg: '#f4e4c4', fg: '#8a5a00', border: '#e5cd99' },
}[laneId] || { bg: '#ece5d7', fg: '#23201a', border: '#dad0bf' });

// ---- TOP LEADERBOARD: rank top 12 across all niches ----
const leaders = [...enriched].sort((a, b) => b._comp - a._comp).slice(0, 12);

// ---- Renderers ----
function renderMasthead() {
  return `
  <header class="masthead">
    <div class="mast-left">
      <div class="kicker">MJB &nbsp;·&nbsp; Ecommerce Trend Intelligence</div>
      <h1>Category Opportunity <span class="accent-italic">Scan</span></h1>
      <p class="mast-sub">${esc(summary.startedAt ? `Pulled ${new Date(summary.startedAt).toLocaleString()}` : '')} · Real RapidAPI: Amazon + Taobao DataHub · Replicate flux-1.1-pro-ultra media · GPT-4o-mini + Gemini-2.5-flash research</p>
    </div>
    <div class="mast-right">
      <div class="legend-title">Reading the bars</div>
      <div class="legend-row">
        <span class="legend-item"><span class="lg-sq" style="background:#d4c4a0"></span>Supply</span>
        <span class="legend-item"><span class="lg-sq" style="background:#9a907f"></span>Amz fees</span>
        <span class="legend-item"><span class="lg-sq" style="background:#c0492a"></span>Profit / opportunity</span>
      </div>
    </div>
  </header>`;
}

function renderKpiBand() {
  return `
  <div class="kpi-band">
    ${kpis.map(k => `
      <div class="kpi-cell">
        <div class="kpi-num" style="color:${esc(k.color)}">${esc(k.num)}</div>
        <div class="kpi-lbl">${esc(k.lbl)}</div>
      </div>
    `).join('')}
  </div>`;
}

function renderToolbar() {
  const tabs = [{ id: 'all', label: 'All', count: enriched.length }];
  for (const [id, items] of Object.entries(byNiche)) tabs.push({ id, label: nicheLabel(id), count: items.length });
  return `
  <div class="toolbar">
    <div class="toolbar-row">
      ${tabs.map(t => `<button class="tab ${t.id === 'all' ? 'active' : ''}" data-tab="${esc(t.id)}">${esc(t.label)} <span class="tab-count">${t.count}</span></button>`).join('')}
    </div>
    <div class="toolbar-row">
      <input type="text" class="search" placeholder="Search product, brand, ASIN…" id="searchInput" />
      <select class="sort-select" id="sortSelect">
        <option value="comp">Sort · Opportunity</option>
        <option value="margin">Sort · Margin %</option>
        <option value="revenue">Sort · Revenue</option>
        <option value="rating">Sort · Rating</option>
        <option value="reviews">Sort · Demand (reviews)</option>
        <option value="price">Sort · Price</option>
      </select>
      <div class="chip-row">
        <button class="chip" data-filter="profitable">Profitable</button>
        <button class="chip" data-filter="hasSupplier">Has supplier</button>
        <button class="chip" data-filter="hasMedia">Has media</button>
        <button class="chip" data-filter="prime">Prime</button>
      </div>
      <div class="range-pill">
        <span class="range-label">Margin ≥</span>
        <input type="range" min="-50" max="55" step="5" value="-50" id="marginRange" />
        <span class="range-val" id="marginRangeVal">any</span>
      </div>
      <div class="view-switcher">
        <button class="view-btn active" data-view="grid">▦ Grid</button>
        <button class="view-btn" data-view="list">≡ List</button>
        <button class="view-btn" data-view="compare">⇆ Compare</button>
      </div>
      <button class="ghost-btn" id="expandAll">Expand all</button>
      <button class="regen-btn" id="regenBtn" title="Re-pull trends + re-generate media + re-render">↻ Regen</button>
    </div>
    <div class="toolbar-meta">Showing <span id="visCount" class="accent-orange">${enriched.length}</span> of ${enriched.length} candidates · scoring model: <b>${esc(scorecard.scorecardVersion || 'balanced')}</b></div>
  </div>`;
}

function renderLeaderboard() {
  return `
  <section class="lb-section">
    <div class="section-hdr">
      <div>
        <h2>Top opportunities</h2>
        <div class="section-sub">Ranked by composite score · across all categories</div>
      </div>
      <button class="ghost-btn small">Hide</button>
    </div>
    <div class="lb-list">
      ${leaders.map((L, i) => {
        const lp = laneCircleColor(L._lane);
        return `
        <div class="lb-row" onclick="document.getElementById('cand-${esc(L.id)}')?.scrollIntoView({behavior:'smooth',block:'center'})">
          <div class="lb-rank">${String(i + 1).padStart(2, '0')}</div>
          <div class="lb-photo">${L.mediaRefs?.[0]?.sourceUrl ? `<img src="${esc(L.mediaRefs[0].sourceUrl)}" alt="">` : `<span class="lb-init" style="background:${lp.bg};color:${lp.fg}">${initial(L._brand)}</span>`}</div>
          <div class="lb-mid">
            <div class="lb-name">${esc(shortName(L.name).slice(0, 60))}</div>
            <div class="lb-meta">${esc(L._brand)} · ${esc(nicheLabel(L._nicheId))}</div>
          </div>
          <div class="lb-metric"><div class="m-lbl">Margin</div><div class="m-val" style="color:${(L._marginPct ?? 0) >= 0 ? '#2c7a3e' : '#9b2d1b'}">${fmtPct(L._marginPct)}</div></div>
          <div class="lb-metric"><div class="m-lbl">Rev/mo</div><div class="m-val">${L._monthlyRev ? (L._monthlyRev > 1_000_000 ? '$' + (L._monthlyRev/1_000_000).toFixed(2) + 'M' : fmtUsd(L._monthlyRev)) : '—'}</div></div>
          <div class="lb-metric"><div class="m-lbl">Markup</div><div class="m-val accent-orange">${L._markup ? L._markup.toFixed(1) + '×' : '—'}</div></div>
          <div class="lb-score" style="background:${L._tierBg};color:${L._tierColor}">${L._comp}</div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

function renderComparisonTable() {
  const rows = Object.entries(byNiche).map(([nicheId, cands]) => {
    const margins = cands.map(c => c._marginPct).filter(n => n != null);
    const avgMargin = margins.length ? margins.reduce((s, n) => s + n, 0) / margins.length : null;
    const ratings = cands.map(c => c.reviewSummary?.avgRating).filter(n => n != null);
    const avgRating = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : null;
    const prices = cands.map(c => c.priceUsd).filter(n => n != null);
    const reviewSum = cands.reduce((s, c) => s + (c.reviewSummary?.count || 0), 0);
    const market = cands.reduce((s, c) => s + (c._monthlyRev || 0), 0);
    const supps = suppliersByNiche[nicheId] || [];
    const cheapestSupp = supps.map(s => s.pricePerUnitUsd).filter(n => n != null).sort((a,b) => a-b)[0];
    const lane = cands[0]?._lane;
    const lp = lanePillColor(lane);
    return `
    <tr onclick="document.getElementById('niche-${esc(nicheId)}')?.scrollIntoView({behavior:'smooth'})">
      <td class="cmp-cat">
        <span class="lane-pill" style="background:${lp.bg};color:${lp.fg};border-color:${lp.border}">${esc(lanesById[lane]?.displayName.replace('MJB ','') || lane)}</span>
        <span class="cmp-name">${esc(nicheLabel(nicheId))}</span>
      </td>
      <td class="cmp-num">${market > 1_000_000 ? '$' + (market/1_000_000).toFixed(2) + 'M' : fmtUsd(market)}</td>
      <td class="cmp-num" style="color:${(avgMargin ?? 0) >= 0 ? '#2c7a3e' : '#9b2d1b'}">${fmtPct(avgMargin)}</td>
      <td class="cmp-num">${avgRating?.toFixed(2) ?? '—'}★</td>
      <td class="cmp-num">${cands.length}</td>
      <td class="cmp-num">${cheapestSupp ? fmtUsd(cheapestSupp, 2) : '—'}</td>
      <td class="cmp-num">${fmtNum(reviewSum)}</td>
    </tr>`;
  }).join('');
  return `
  <section class="cmp-section">
    <div class="section-hdr">
      <div>
        <h2>Category comparison</h2>
        <div class="section-sub">Click a row to jump to the category</div>
      </div>
    </div>
    <table class="cmp-table">
      <thead>
        <tr><th>Category</th><th>Market /mo</th><th>Avg margin</th><th>Avg rating</th><th>SKUs</th><th>Floor cost</th><th>Reviews</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderShopIdentity(nicheId) {
  const concept = shopConcepts[nicheId];
  const logo = shopLogoIndex[nicheId];
  if (!concept) return '';
  const palette = (concept.colorPaletteHints || []).slice(0, 6).map(hex => `<span class="sh-sw" style="background:${esc(hex)};color:${getContrast(hex)}">${esc(hex)}</span>`).join('');
  const logoFile = logo?.file?.replace(/^mockups\//, '');
  return `
  <div class="shop-identity">
    <div class="shop-logo-col">
      ${logoFile ? `<a href="${esc(logoFile)}" target="_blank" class="shop-logo-frame"><img src="${esc(logoFile)}" alt="${esc(concept.shopName)} logo"></a>` : '<div class="shop-logo-frame pending">logo pending</div>'}
    </div>
    <div class="shop-id-col">
      <div class="block-kicker">Ideal shop identity · auto-generated</div>
      <h3 class="shop-name">${esc(concept.shopName)}</h3>
      <p class="shop-tag">${esc(concept.shopTagline)}</p>
      <div class="shop-meta-row">
        <span class="shop-arch">${esc(concept.brandArchetype)}</span>
        <span class="shop-typo">${esc(concept.typographyHint)}</span>
        <span class="shop-voice">${esc(concept.voiceTone)}</span>
      </div>
      <div class="shop-palette">${palette}</div>
      <p class="shop-rationale">${esc(concept.archetypeReasoning || '')}</p>
    </div>
  </div>`;
}

function renderNicheBlock(nicheId, cands) {
  const lane = cands[0]?._lane;
  const laneObj = lanesById[lane];
  const lp = lanePillColor(lane);
  const trendsT = trendsRes?.results?.[nicheId];
  const ugcT = ugcRes?.results?.[nicheId];
  const trendsGEMt = trendsGEM?.results?.[nicheId];
  const supps = suppliersByNiche[nicheId] || [];
  const cheapest = supps.map(s => s.pricePerUnitUsd).filter(n => n != null).sort((a,b)=>a-b)[0];
  const market = cands.reduce((s, c) => s + (c._monthlyRev || 0), 0);
  const reviewSum = cands.reduce((s, c) => s + (c.reviewSummary?.count || 0), 0);
  const prices = cands.map(c => c.priceUsd).filter(n => n != null).sort((a,b)=>a-b);
  const med = prices[Math.floor(prices.length/2)];
  const nicheMeta = summary.niches?.find(n => n.id === nicheId);
  return `
  <section class="niche-block" id="niche-${esc(nicheId)}" data-niche="${esc(nicheId)}" data-lane="${esc(lane)}">
    <div class="niche-hdr">
      <div>
        <h2>${esc(nicheLabel(nicheId))}</h2>
        <div class="niche-sub">${cands.length} candidates · ${supps.length} suppliers · query: "${esc(nicheMeta?.query || '')}"</div>
      </div>
      <div class="niche-meta-chips">
        <span class="lane-pill" style="background:${lp.bg};color:${lp.fg};border-color:${lp.border}">${esc(laneObj?.displayName || lane)}</span>
        ${trendsT?.marketSentiment ? `<span class="chip-tier tier-${trendsT.marketSentiment.toLowerCase()}">${esc(trendsT.marketSentiment)}</span>` : ''}
        ${trendsT?.competitionAnalysis?.tier ? `<span class="chip-tier tier-${trendsT.competitionAnalysis.tier.toLowerCase()}">${esc(trendsT.competitionAnalysis.tier)} COMPETITION</span>` : ''}
      </div>
    </div>

    ${renderShopIdentity(nicheId)}

    <div class="persona-row">
      <div class="persona-block">
        <div class="block-kicker">Persona</div>
        <div class="persona-text">${esc(laneObj?.audience || '')}</div>
        <div class="persona-meta">
          <span><b>Tone:</b> ${esc(laneObj?.tone || '')}</span>
          <span><b>Sweet:</b> $${laneObj?.priceBand?.sweetSpot ?? '—'} (${laneObj?.priceBand?.min}–${laneObj?.priceBand?.max})</span>
        </div>
      </div>
      <div class="market-block">
        <div class="block-kicker">Market intelligence</div>
        <div class="market-grid">
          <div><span class="mk-lbl">Market /mo</span><span class="mk-val accent-orange">${market > 1_000_000 ? '$' + (market/1_000_000).toFixed(2) + 'M' : fmtUsd(market)}</span></div>
          <div><span class="mk-lbl">Median price</span><span class="mk-val">${fmtUsd(med)}</span></div>
          <div><span class="mk-lbl">Reviews</span><span class="mk-val">${fmtNum(reviewSum)}</span></div>
          <div><span class="mk-lbl">Floor cost</span><span class="mk-val">${cheapest ? fmtUsd(cheapest, 2) : '—'}</span></div>
          <div><span class="mk-lbl">Sub-trends</span><span class="mk-val">${trendsT?.topEmergingSubTrends?.length || 0}</span></div>
          <div><span class="mk-lbl">Seasonality</span><span class="mk-val">${esc(trendsT?.seasonality || '—').replace('_', ' ')}</span></div>
        </div>
      </div>
    </div>

    ${trendsT ? `
    <div class="research-row">
      <div class="research-card">
        <div class="block-kicker">Emerging sub-trends · GPT-4o</div>
        <ul class="bullets">
          ${(trendsT.topEmergingSubTrends || []).map(s => `<li><b>${esc(s.subTrend)}</b> <span class="conf conf-${s.confidence}">${esc(s.confidence)}</span><br><span class="muted">${esc(s.evidenceFromData)}</span></li>`).join('')}
        </ul>
      </div>
      <div class="research-card">
        <div class="block-kicker">Audience pain points</div>
        <ul class="bullets">${(trendsT.audiencePainPoints || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>
      <div class="research-card">
        <div class="block-kicker">Keywords by intent</div>
        <div class="kw-stack">
          <div class="kw-line"><span class="kw-l">buy</span> ${(trendsT.topKeywordsByIntent?.buying || []).slice(0,5).map(k=>`<span class="kw-tag kw-buy">${esc(k)}</span>`).join('')}</div>
          <div class="kw-line"><span class="kw-l">research</span> ${(trendsT.topKeywordsByIntent?.research || []).slice(0,5).map(k=>`<span class="kw-tag kw-rsch">${esc(k)}</span>`).join('')}</div>
          <div class="kw-line"><span class="kw-l">compare</span> ${(trendsT.topKeywordsByIntent?.comparison || []).slice(0,5).map(k=>`<span class="kw-tag kw-cmp">${esc(k)}</span>`).join('')}</div>
        </div>
      </div>
    </div>
    ` : ''}

    ${ugcT ? `
    <details class="ugc-collapse">
      <summary>UGC playbook · ${ugcT.amazonListingImages?.recommendedCount || '?'} listing images · ${ugcT.shortFormVideoUgc?.idealLengthSec || '?'}s video</summary>
      <div class="ugc-inner">
        <div class="ugc-card">
          <div class="block-kicker">📸 Listing image plan</div>
          <div class="slot-grid">
            ${(ugcT.amazonListingImages?.imageBreakdown || []).map((s, i) => `
              <div class="slot">
                <div class="slot-n">${i + 1}</div>
                <div class="slot-l">${esc(s.slot)}</div>
                <div class="slot-p">${esc(s.purpose)}</div>
                <div class="slot-row"><b>Light:</b> ${esc(s.lightingNotes)}</div>
                <div class="slot-row"><b>Comp:</b> ${esc(s.compositionNotes)}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="ugc-card">
          <div class="block-kicker">📱 Short-form UGC</div>
          <div class="ugc-row"><b>Length:</b> ${ugcT.shortFormVideoUgc?.idealLengthSec}s · <b>Tags:</b> ${ugcT.shortFormVideoUgc?.hashtagCount}</div>
          <div class="ugc-row"><b>Hooks:</b> ${(ugcT.shortFormVideoUgc?.openingHookStyles||[]).map(h=>`<span class="mini-pill">${esc(h)}</span>`).join(' ')}</div>
          <div class="ugc-row"><b>Lighting:</b><br>${(ugcT.shortFormVideoUgc?.lightingRecommendations||[]).map(l=>`<div class="indent">▸ ${esc(l)}</div>`).join('')}</div>
          <div class="ugc-row"><b>Audio:</b> ${esc(ugcT.shortFormVideoUgc?.audioStyle)}</div>
          <div class="ugc-row"><b>Caption:</b> ${esc(ugcT.shortFormVideoUgc?.captionStyle)}</div>
        </div>
        <div class="ugc-card">
          <div class="block-kicker">📝 Listing description</div>
          <div class="ugc-row"><b>Title chars:</b> ${esc(ugcT.productDescriptionPractices?.titleCharRange)}</div>
          <div class="ugc-row"><b>Structure:</b> <code>${esc(ugcT.productDescriptionPractices?.titleStructure)}</code></div>
          <div class="ugc-row"><b>Bullets:</b> ${ugcT.productDescriptionPractices?.bulletPoints?.count} × ${esc(ugcT.productDescriptionPractices?.bulletPoints?.lengthPerBulletWords)} words</div>
          <div class="ugc-row"><b>A+:</b> ${ugcT.productDescriptionPractices?.aPlusContentRecommended ? '✅ recommended' : '⚠ optional'}</div>
          <div class="ugc-row"><b>Voice:</b> ${esc(ugcT.productDescriptionPractices?.voiceAndTone)}</div>
        </div>
        <div class="ugc-card">
          <div class="block-kicker">Differentiators ✓ / Mistakes ✗</div>
          <ul class="bullets bullets-good">${(ugcT.differentiatorPlays || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          <ul class="bullets bullets-bad" style="margin-top:10px">${(ugcT.commonMistakes || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>
      </div>
    </details>
    ` : ''}

    <div class="prod-grid">
      ${cands.map(renderProductCard).join('')}
    </div>
  </section>`;
}

function renderProductCard(c) {
  const gen = genIndex[c.id];
  const assets = gen?.assets || [];
  const heroA = assets.find(a => a.kind === 'hero');
  const lifeA = assets.find(a => a.kind === 'lifestyle');
  const baA = assets.find(a => a.kind === 'before-after');
  const fileFor = (a) => a ? a.file.replace(/^mockups\//, '') : null;
  const lp = laneCircleColor(c._lane);
  const matchSupp = (suppliersByNiche[c._nicheId] || []).find(s => s.id === c._probableSupplyMatchSupplierId) || (suppliersByNiche[c._nicheId] || [])[0];

  return `
  <article id="cand-${esc(c.id)}" class="prod-card" data-tier="${c._tier}" data-margin="${c._marginPct ?? -1}" data-hasmedia="${assets.length > 0}" data-hassupplier="${!!matchSupp}" data-prime="${!!c.competitiveContext?.isPrime}" data-name="${esc((c.name + ' ' + c._brand + ' ' + c.sourceId).toLowerCase())}">
    <div class="prod-hdr">
      <div class="prod-photo">
        ${c.mediaRefs?.[0]?.sourceUrl ? `<img src="${esc(c.mediaRefs[0].sourceUrl)}" alt="${esc(c.name)}">` : `<span class="lb-init" style="background:${lp.bg};color:${lp.fg}">${initial(c._brand)}</span>`}
      </div>
      <div class="prod-info">
        <div class="prod-brand-row">
          <span class="brand-circle" style="background:${lp.bg};color:${lp.fg}">${initial(c._brand)}</span>
          <span class="brand-label">${esc(c._brand)}</span>
          <span class="asin">${esc(c.sourceId)}</span>
          ${c.competitiveContext?.salesVolume ? `<span class="vol-pill">${esc(c.competitiveContext.salesVolume)}</span>` : ''}
        </div>
        <div class="prod-name">${esc(shortName(c.name))}</div>
        <div class="prod-price-row">
          <span class="price-big">${fmtUsd(c.priceUsd, 2)}</span>
          ${c.reviewSummary ? `<span class="rating-row">★ ${c.reviewSummary.avgRating.toFixed(1)} <span class="muted">(${fmtNum(c.reviewSummary.count)})</span></span>` : ''}
        </div>
        <div class="badge-row">
          ${c.competitiveContext?.isBestSeller ? '<span class="badge badge-best">Best Seller</span>' : ''}
          ${c.competitiveContext?.isAmazonChoice ? '<span class="badge badge-choice">Amazon\'s Choice</span>' : ''}
          ${c.competitiveContext?.isPrime ? '<span class="badge badge-prime">Prime</span>' : ''}
        </div>
      </div>
      <div class="prod-tier" style="background:${c._tierBg};color:${c._tierColor}">
        <div class="tier-num">${c._comp}</div>
        <div class="tier-lbl">${c._tier}</div>
      </div>
    </div>

    <div class="prod-metrics">
      <div class="metric"><div class="m-lbl">Rev/mo</div><div class="m-val">${c._monthlyRev ? (c._monthlyRev > 1_000_000 ? '$' + (c._monthlyRev/1_000_000).toFixed(2) + 'M' : fmtUsd(c._monthlyRev)) : '—'}</div></div>
      <div class="metric"><div class="m-lbl">Margin</div><div class="m-val" style="color:${(c._marginPct ?? 0) >= 0 ? '#2c7a3e' : '#9b2d1b'}">${fmtPct(c._marginPct)}</div></div>
      <div class="metric"><div class="m-lbl">Profit/unit</div><div class="m-val" style="color:${(c._profitU ?? 0) >= 0 ? '#2c7a3e' : '#9b2d1b'}">${c._profitU ? (c._profitU > 0 ? '+' : '') + fmtUsd(c._profitU, 2) : '—'}</div></div>
      <div class="metric"><div class="m-lbl">Markup</div><div class="m-val accent-orange">${c._markup ? c._markup.toFixed(1) + '×' : '—'}</div></div>
      <div class="metric"><div class="m-lbl">Reviews/mo</div><div class="m-val">${fmtNum(c._reviewVelocity)}</div></div>
      <div class="metric"><div class="m-lbl">BE CPC@3%</div><div class="m-val">${c._profitU > 0 ? fmtUsd(c._profitU * 0.03, 2) : '—'}</div></div>
    </div>

    ${heroA || lifeA || baA ? `
      <div class="prod-gen">
        <div class="block-kicker">✦ Generated · flux-1.1-pro-ultra</div>
        <div class="gen-strip">
          ${heroA ? `<a href="${esc(fileFor(heroA))}" target="_blank" class="gen-tile"><img src="${esc(fileFor(heroA))}"><span class="gen-tag">hero</span></a>` : ''}
          ${lifeA ? `<a href="${esc(fileFor(lifeA))}" target="_blank" class="gen-tile"><img src="${esc(fileFor(lifeA))}"><span class="gen-tag">life</span></a>` : ''}
          ${baA ? `<a href="${esc(fileFor(baA))}" target="_blank" class="gen-tile"><img src="${esc(fileFor(baA))}"><span class="gen-tag">b/a</span></a>` : ''}
        </div>
        <button class="regen-mini" onclick="regenerateOne('${esc(c.id)}')" title="Regenerate media for this product">↻</button>
      </div>
    ` : `
      <div class="prod-gen empty">
        <div class="block-kicker">No generated media</div>
        <button class="regen-mini big" onclick="regenerateOne('${esc(c.id)}')">↻ Generate</button>
      </div>
    `}

    ${matchSupp ? `
      <div class="prod-supp">
        <div class="block-kicker">⊕ Taobao supplier match</div>
        <div class="supp-row">
          <div class="supp-photo">${matchSupp._image ? `<img src="${esc(matchSupp._image)}">` : '<span>📦</span>'}</div>
          <div class="supp-body">
            <div class="supp-name">${esc((matchSupp._productName || '').slice(0, 80))}</div>
            <div class="supp-meta">${esc(matchSupp.supplierName)} · ${esc(matchSupp._shippingFrom || matchSupp.region || 'CN')}</div>
            <div class="supp-pills">
              ${matchSupp._priceOriginal?.value != null ? `<span class="sp">¥${matchSupp._priceOriginal.value}</span>` : ''}
              ${matchSupp.pricePerUnitUsd != null ? `<span class="sp sp-usd">≈ ${fmtUsd(matchSupp.pricePerUnitUsd, 2)}</span>` : ''}
              <span class="sp sp-conf">match ${(matchSupp.productMatchConfidence*100).toFixed(0)}%</span>
              ${matchSupp._sales && matchSupp._sales !== '0' ? `<span class="sp">${esc(matchSupp._sales)} sold</span>` : ''}
            </div>
            <a href="${esc(matchSupp.urls?.[0] || '#')}" target="_blank" class="src-link">item.taobao.com →</a>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="prod-foot">
      <a href="${esc(c.urls?.[0] || '#')}" target="_blank" class="src-link mono">amazon.com/dp/${esc(c.sourceId)} →</a>
    </div>
  </article>`;
}

// Design concepts section — side-by-side OpenAI vs Gemini per lane
function renderConcepts() {
  if (!concOAI) return '';
  const sections = lanes.map(lane => {
    const a = concOAI?.results?.[lane.laneId];
    const b = concGEM?.results?.[lane.laneId];
    return `
    <div class="lane-concept-block">
      <div class="lane-concept-hdr">
        <span class="lane-pill" style="background:${lanePillColor(lane.laneId).bg};color:${lanePillColor(lane.laneId).fg};border-color:${lanePillColor(lane.laneId).border}">${esc(lane.displayName)}</span>
        <span class="lane-aud">${esc(lane.audience)}</span>
      </div>
      <div class="concept-grid">
        ${renderConceptCard(lane.laneId, a, `OpenAI · ${concOAI?.model || 'gpt-4o-mini'}`)}
        ${b ? renderConceptCard(lane.laneId, b, `Gemini · ${concGEM?.model || 'gemini-2.5-flash'}`) : '<div class="concept-card pending"><div class="block-kicker">Gemini · pending</div><div class="muted">Awaiting Gemini key.</div></div>'}
      </div>
    </div>`;
  }).join('');
  return `
  <section class="concepts-section" id="concepts">
    <div class="section-hdr">
      <div>
        <h2>Brand <span class="accent-italic">concepts</span></h2>
        <div class="section-sub">Two LLM-generated brand directions per lane — palette, typography, components, voice</div>
      </div>
      <button class="regen-btn small" onclick="regenerateConcepts()" title="Re-run both OpenAI and Gemini concept generation">↻ Regen concepts</button>
    </div>
    ${sections}
  </section>`;
}

function getContrast(hex) {
  if (!hex) return '#000';
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.55 ? '#000' : '#fff';
}

function renderConceptCard(laneId, c, source) {
  if (!c) return '';
  const palette = Object.values(c.colorPalette || {}).map(col => `
    <div class="sw" style="background:${esc(col.hex)};color:${getContrast(col.hex)}">
      <div class="sw-name">${esc(col.name)}</div>
      <div class="sw-hex">${esc(col.hex)}</div>
    </div>`).join('');
  const typo = c.typography || {};
  return `
  <div class="concept-card">
    <div class="concept-kicker">${esc(source)}</div>
    <h3 class="concept-name">${esc(c.conceptName)}</h3>
    <p class="concept-tag">${esc(c.conceptTagline)}</p>
    <p class="concept-phil">${esc(c.designPhilosophy)}</p>

    <div class="block-kicker">Palette</div>
    <div class="palette">${palette}</div>

    <div class="block-kicker">Typography · ${esc(typo.displayFont?.name)} / ${esc(typo.bodyFont?.name)}</div>
    <div class="typo-preview">
      <div class="typo-sample" style="font-family:'${esc(typo.displayFont?.name || 'Newsreader')}',serif;font-weight:700">${esc(c.voiceAndTone?.exampleHeadline || 'Aa')}</div>
      <div class="typo-body" style="font-family:'${esc(typo.bodyFont?.name || 'Archivo')}',sans-serif">${esc(c.voiceAndTone?.exampleProductCopy || 'The quick brown fox jumps over the lazy dog.')}</div>
    </div>

    <div class="block-kicker">Voice ✓ / ✗</div>
    <div class="dodont">
      <ul class="bullets bullets-good">${(c.voiceAndTone?.doSayList || []).slice(0,3).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <ul class="bullets bullets-bad">${(c.voiceAndTone?.dontSayList || []).slice(0,3).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </div>

    <div class="block-kicker">Differentiators</div>
    <ul class="bullets">${(c.differentiatingDetails || []).map(d => `<li>${esc(d)}</li>`).join('')}</ul>
  </div>`;
}

// Shop identities gallery — dynamic per-niche shop logos + concepts
function renderLogos() {
  const niches = Object.keys(byNiche);
  return `
  <section class="logos-section" id="logos">
    <div class="section-hdr">
      <div>
        <h2>Shop <span class="accent-italic">identities</span></h2>
        <div class="section-sub">For each trending niche: the fictional ideal shop that would sell this category most effectively · LLM-generated concept + Replicate flux-1.1-pro-ultra logo</div>
      </div>
      <button class="regen-btn small" onclick="regenerateLogos()" title="Re-run shop concept + logo generation">↻ Regen identities</button>
    </div>
    <div class="shop-gallery">
      ${niches.map(nicheId => {
        const concept = shopConcepts[nicheId];
        const logo = shopLogoIndex[nicheId];
        const logoFile = logo?.file?.replace(/^mockups\//, '');
        if (!concept) {
          return `<div class="shop-card pending">
            <div class="shop-card-logo pending">pending</div>
            <div class="block-kicker">${esc(nicheLabel(nicheId))}</div>
            <div class="muted">Concept + logo pending</div>
          </div>`;
        }
        const palette = (concept.colorPaletteHints || []).slice(0, 6).map(hex => `<span class="sh-sw" style="background:${esc(hex)};color:${getContrast(hex)}">${esc(hex)}</span>`).join('');
        return `
        <div class="shop-card">
          <a href="${esc(logoFile || '#')}" target="_blank" class="shop-card-logo">${logoFile ? `<img src="${esc(logoFile)}" alt="${esc(concept.shopName)} logo">` : '<span class="muted">logo pending</span>'}</a>
          <div class="shop-card-meta">
            <div class="block-kicker">Sells: ${esc(nicheLabel(nicheId))}</div>
            <h3 class="shop-name">${esc(concept.shopName)}</h3>
            <p class="shop-tag">${esc(concept.shopTagline)}</p>
            <div class="shop-meta-row">
              <span class="shop-arch">${esc(concept.brandArchetype)}</span>
            </div>
            <div class="shop-meta-row muted small">${esc(concept.typographyHint)} · ${esc(concept.voiceTone)}</div>
            <div class="shop-palette">${palette}</div>
            <p class="shop-rationale">${esc(concept.archetypeReasoning || '')}</p>
          </div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

// Shop previews
function renderShops() {
  return `
  <section class="shops-section" id="shops">
    <div class="section-hdr">
      <div>
        <h2>Shop <span class="accent-italic">previews</span></h2>
        <div class="section-sub">Codex-generated customer-facing storefronts · one per brand lane</div>
      </div>
      <button class="regen-btn small" onclick="regenerateShops()" title="Re-dispatch codex">↻ Regen shops</button>
    </div>
    ${shopPreviews.length > 0 ? `
      <div class="shop-grid">
        ${shopPreviews.map(f => `
          <div class="shop-tile">
            <div class="shop-hdr">
              <h3>${esc(f.replace('.html', ''))}</h3>
              <a href="shop-previews/${esc(f)}" target="_blank" class="open-link">Open ↗</a>
            </div>
            <iframe src="shop-previews/${esc(f)}" loading="lazy"></iframe>
          </div>
        `).join('')}
      </div>
    ` : `
      <div class="empty-block">
        Codex shop preview generation is running in the background. Output will land at <code>mockups/shop-previews/*.html</code>.
      </div>
    `}
  </section>`;
}

// Inspiration section (collapsed by default)
function renderInspiration() {
  if (!inspRes) return '';
  return `
  <section class="insp-section">
    <div class="section-hdr">
      <div>
        <h2>Shop design <span class="accent-italic">inspiration</span></h2>
        <div class="section-sub">Per brand-lane: archetype + reference sites + layout patterns + CTA conventions</div>
      </div>
    </div>
    ${lanes.map(lane => {
      const ins = inspRes.results?.[lane.laneId];
      if (!ins) return '';
      const lp = lanePillColor(lane.laneId);
      return `
        <details class="insp-card" open>
          <summary>
            <span class="lane-pill" style="background:${lp.bg};color:${lp.fg};border-color:${lp.border}">${esc(lane.displayName)}</span>
            <span class="arch">${esc(ins.designArchetype)}</span>
            <span class="muted">${esc(ins.archetypeReasoning).slice(0, 80)}</span>
          </summary>
          <div class="insp-body">
            <div class="block-kicker">Reference sites</div>
            <div class="ref-grid">
              ${(ins.referenceSitesByVibe || []).map(r => `
                <div class="ref-card">
                  <div class="ref-name">${esc(r.siteName)}</div>
                  <div class="ref-vibe">${esc(r.vibe)}</div>
                  <div class="ref-why">${esc(r.whyRelevant)}</div>
                </div>
              `).join('')}
            </div>
            <div class="block-kicker">Layout patterns</div>
            <div class="layout-grid">
              <div><span class="mk-lbl">Hero</span><span class="mk-val">${esc(ins.layoutPatterns?.homepageHeroPattern)}</span></div>
              <div><span class="mk-lbl">Grid</span><span class="mk-val">${esc(ins.layoutPatterns?.productGridPattern)}</span></div>
              <div><span class="mk-lbl">Detail</span><span class="mk-val">${esc(ins.layoutPatterns?.productDetailPattern)}</span></div>
              <div><span class="mk-lbl">Checkout</span><span class="mk-val">${esc(ins.layoutPatterns?.checkoutPattern)}</span></div>
            </div>
            <div class="block-kicker">Trust + CTA + nav</div>
            <div class="muted">
              <b>Trust:</b> ${(ins.trustElements || []).map(t => `<span class="mini-pill">${esc(t)}</span>`).join(' ')}<br>
              <b>Primary CTA:</b> ${esc(ins.ctaStyle?.primaryButton)} · <b>Voice:</b> ${esc(ins.ctaStyle?.microcopyVoice)}<br>
              <b>Navigation:</b> ${esc(ins.navigationPattern)} · <b>Imagery:</b> ${esc(ins.imageryDirection)}
            </div>
          </div>
        </details>
      `;
    }).join('')}
  </section>`;
}

// ===== Assemble HTML =====
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MJB · Category Opportunity Scan</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,16..72,400;0,16..72,500;0,16..72,600;1,16..72,400;1,16..72,500&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#f4efe6;color:#23201a;font-family:'Archivo',system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;line-height:1.5}
::selection{background:#c0492a;color:#fff}
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-thumb{background:#d3c8b4;border:3px solid #f4efe6;border-radius:8px}
::-webkit-scrollbar-thumb:hover{background:#c0b59f}
a{color:#c0492a;text-decoration:none}
code{background:#fcf9f3;padding:1px 6px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#6f6658;border:1px solid #ece5d7}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.wrap{max-width:1340px;margin:0 auto;padding:34px 26px 90px}
.accent-orange{color:#c0492a}
.accent-italic{font-style:italic;color:#c0492a}
.muted{color:#6f6658;font-size:12px}
.kicker,.block-kicker{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#c0492a;font-weight:700}
.block-kicker{color:#a89e8d;font-size:9.5px;letter-spacing:1.2px;margin-bottom:8px;font-weight:700}

/* Masthead */
.masthead{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;animation:rise .5s ease both}
.mast-left{max-width:760px}
.mast-left h1{font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1.02;letter-spacing:-1px;margin-top:10px;color:#23201a}
.mast-sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:#6f6658;margin-top:12px;line-height:1.7}
.mast-right{display:flex;flex-direction:column;gap:8px;align-items:flex-end;min-width:230px}
.legend-title{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#a89e8d}
.legend-row{display:flex;gap:14px;flex-wrap:wrap;justify-content:flex-end}
.legend-item{display:flex;align-items:center;gap:6px;font-size:11px;color:#6f6658}
.lg-sq{width:11px;height:11px;border-radius:3px}

/* KPI band */
.kpi-band{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));border:1px solid #dad0bf;border-radius:6px;background:#fcf9f3;overflow:hidden;margin:26px 0 8px}
.kpi-cell{padding:16px 18px;border-right:1px solid #ece5d7;border-bottom:1px solid #ece5d7}
.kpi-num{font-size:27px;font-weight:800;letter-spacing:-.7px;font-variant-numeric:tabular-nums;line-height:1}
.kpi-lbl{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#6f6658;margin-top:8px}

/* Toolbar */
.toolbar{position:sticky;top:0;z-index:30;background:#f4efe6;padding:14px 0 12px;margin-bottom:8px;box-shadow:0 1px 0 #dad0bf}
.toolbar-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.toolbar-row:last-of-type{margin-bottom:0}
.tab{font-family:'Archivo';font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:999px;cursor:pointer;background:#fcf9f3;color:#23201a;border:1px solid #dad0bf;transition:all .12s}
.tab:hover{background:#ece5d7}
.tab.active{background:#23201a;color:#fff;border-color:#23201a}
.tab-count{opacity:.55;font-variant-numeric:tabular-nums;font-weight:500;margin-left:4px}
.search{font-family:'Archivo';font-size:13px;padding:9px 13px;border-radius:6px;border:1px solid #d8cfbe;background:#fff;color:#23201a;width:248px;outline:none}
.search:focus{border-color:#c0492a}
.sort-select{font-family:'Archivo';font-size:12.5px;font-weight:600;padding:9px 30px 9px 13px;border-radius:6px;border:1px solid #d8cfbe;background:#fff url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22><path d=%22M1 3l4 4 4-4%22 fill=%22none%22 stroke=%22%236f6658%22 stroke-width=%221.6%22/></svg>') no-repeat right 11px center;color:#23201a;cursor:pointer;appearance:none;-webkit-appearance:none}
.chip-row{display:flex;gap:6px;flex-wrap:wrap}
.chip{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;font-weight:700;padding:8px 11px;border-radius:6px;cursor:pointer;background:#fff;color:#6f6658;border:1px solid #d8cfbe;transition:all .12s}
.chip:hover{background:#fcf9f3}
.chip.active{background:#23201a;color:#fff;border-color:#23201a}
.range-pill{display:flex;align-items:center;gap:9px;padding:7px 12px;border:1px solid #d8cfbe;border-radius:6px;background:#fff}
.range-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#6f6658}
.range-pill input[type=range]{width:90px;accent-color:#c0492a}
.range-val{font-family:'Archivo';font-size:12px;font-weight:700;color:#c0492a;font-variant-numeric:tabular-nums;min-width:30px}
.view-switcher{display:flex;border:1px solid #d8cfbe;border-radius:6px;overflow:hidden;background:#fff}
.view-btn{font-family:'Archivo';font-size:11.5px;font-weight:600;padding:7px 11px;background:transparent;color:#6f6658;border:0;cursor:pointer;border-right:1px solid #ece5d7}
.view-btn:last-child{border-right:0}
.view-btn.active{background:#23201a;color:#fff}
.ghost-btn{font-family:'Archivo';font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:6px;cursor:pointer;background:transparent;color:#23201a;border:1px solid #23201a;margin-left:auto}
.ghost-btn:hover{background:#23201a;color:#fff}
.ghost-btn.small{padding:5px 10px;font-size:11px;margin-left:0}
.regen-btn{font-family:'Archivo';font-size:12.5px;font-weight:700;padding:8px 14px;border-radius:6px;cursor:pointer;background:#c0492a;color:#fff;border:1px solid #c0492a}
.regen-btn:hover{background:#a13f25}
.regen-btn.small{padding:5px 10px;font-size:11px}
.toolbar-meta{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#a89e8d;margin-top:10px;letter-spacing:.4px}

/* Section header */
.section-hdr{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:2px solid #23201a;padding-bottom:10px;margin-bottom:14px;margin-top:36px}
.section-hdr h2{font-family:'Newsreader',serif;font-weight:500;font-size:27px;letter-spacing:-.4px;color:#23201a}
.section-sub{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#6f6658;margin-top:3px}

/* Leaderboard */
.lb-section{margin-top:22px}
.lb-list{display:flex;flex-direction:column}
.lb-row{display:grid;grid-template-columns:40px 46px minmax(0,1fr) auto auto auto 66px;gap:16px;align-items:center;padding:13px 6px;border-bottom:1px solid #e8e1d2;cursor:pointer;transition:background .12s}
.lb-row:hover{background:#faf6ee}
.lb-rank{font-family:'Newsreader',serif;font-size:30px;font-weight:500;color:#cbbfa9;text-align:center;font-variant-numeric:tabular-nums}
.lb-photo{width:46px;height:46px;border-radius:6px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center}
.lb-photo img{width:100%;height:100%;object-fit:contain;padding:4px}
.lb-init{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;font-family:'Archivo'}
.lb-mid{min-width:0}
.lb-name{font-size:13.5px;font-weight:600;color:#23201a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-meta{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:#a89e8d;margin-top:3px}
.lb-metric{text-align:right}
.m-lbl{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.6px;text-transform:uppercase;color:#a89e8d;font-weight:700}
.m-val{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;color:#23201a;margin-top:1px}
.lb-score{padding:7px 0;border-radius:6px;text-align:center;font-weight:800;font-size:18px;font-variant-numeric:tabular-nums}

/* Comparison table */
.cmp-section{margin-top:22px}
.cmp-table{width:100%;border-collapse:collapse;font-size:13px;background:#fcf9f3;border:1px solid #dad0bf;border-radius:6px;overflow:hidden}
.cmp-table thead th{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#a89e8d;text-align:left;padding:12px 14px;background:#ece5d7;border-bottom:1px solid #dad0bf;font-weight:700}
.cmp-table tbody tr{cursor:pointer;transition:background .12s;border-bottom:1px solid #ece5d7}
.cmp-table tbody tr:hover{background:#faf6ee}
.cmp-table tbody tr:last-child{border-bottom:0}
.cmp-table td{padding:12px 14px;font-variant-numeric:tabular-nums}
.cmp-cat{display:flex;flex-direction:column;gap:4px}
.cmp-name{font-weight:600;color:#23201a}
.cmp-num{text-align:right;font-weight:600;color:#23201a}

/* Lane pill */
.lane-pill{display:inline-flex;align-items:center;padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:700;border:1px solid;text-transform:uppercase;letter-spacing:.5px}
.chip-tier{display:inline-block;padding:3px 9px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.5px;text-transform:uppercase;font-weight:700}
.tier-bullish,.tier-fast_growing,.tier-emerging,.tier-open,.tier-low{background:#dceede;color:#2c7a3e;border:1px solid #b9d6bc}
.tier-stable,.tier-steady,.tier-medium{background:#e6e3f0;color:#5a4e8f;border:1px solid #cac3df}
.tier-declining,.tier-saturated,.tier-extreme,.tier-high,.tier-mature{background:#f4e4c4;color:#8a5a00;border:1px solid #e5cd99}

/* Niche block */
.niche-block{margin-top:48px;animation:rise .5s ease both}
.niche-hdr{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;border-bottom:2px solid #23201a;padding-bottom:10px;margin-bottom:14px}
.niche-hdr h2{font-family:'Newsreader',serif;font-weight:500;font-size:32px;letter-spacing:-.4px;color:#23201a}
.niche-sub{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#6f6658;margin-top:3px}
.niche-meta-chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}

/* Persona/Market row */
.persona-row{display:grid;grid-template-columns:1fr 1.4fr;gap:14px;margin-bottom:18px}
.persona-block,.market-block{background:#fcf9f3;border:1px solid #dad0bf;border-radius:6px;padding:16px 18px}
.persona-text{font-size:14px;color:#23201a;margin:8px 0 12px;line-height:1.6}
.persona-meta{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:#6f6658}
.market-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px}
.market-grid > div{display:flex;flex-direction:column;gap:3px}
.mk-lbl{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.6px;text-transform:uppercase;color:#a89e8d;font-weight:700}
.mk-val{font-size:14px;font-weight:700;color:#23201a;font-variant-numeric:tabular-nums}

/* Research row */
.research-row{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:12px;margin-bottom:18px}
.research-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:6px;padding:14px 16px}
.bullets{list-style:none;padding:0;font-size:12px;line-height:1.55}
.bullets li{padding:4px 0;border-bottom:1px dashed #ece5d7}
.bullets li:last-child{border-bottom:0}
.bullets li::before{content:"▸";color:#c0492a;font-weight:700;margin-right:5px}
.bullets-good li::before{content:"✓";color:#2c7a3e}
.bullets-bad li::before{content:"✗";color:#9b2d1b}
.conf{display:inline-block;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:5px;font-weight:700;text-transform:uppercase;font-family:'JetBrains Mono',monospace}
.conf-high{background:#dceede;color:#2c7a3e}
.conf-medium{background:#f4e4c4;color:#8a5a00}
.conf-low{background:#ece5d7;color:#6f6658}
.kw-stack{display:flex;flex-direction:column;gap:6px}
.kw-line{display:flex;align-items:flex-start;gap:6px;font-size:11px;flex-wrap:wrap}
.kw-l{font-family:'JetBrains Mono',monospace;font-size:9px;color:#a89e8d;text-transform:uppercase;letter-spacing:.5px;font-weight:700;padding-top:3px;min-width:50px}
.kw-tag{padding:2px 7px;border-radius:3px;font-size:10px;font-weight:600}
.kw-buy{background:#dceede;color:#2c7a3e}
.kw-rsch{background:#e6e3f0;color:#5a4e8f}
.kw-cmp{background:#f4e4c4;color:#8a5a00}

/* UGC collapse */
.ugc-collapse{background:#fcf9f3;border:1px solid #dad0bf;border-radius:6px;margin-bottom:18px}
.ugc-collapse summary{cursor:pointer;padding:14px 18px;font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#23201a;font-weight:700}
.ugc-collapse[open] summary{border-bottom:1px solid #dad0bf}
.ugc-inner{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px}
.ugc-card{background:#fff;border:1px solid #ece5d7;border-radius:6px;padding:14px}
.ugc-row{font-size:12px;margin:6px 0;line-height:1.5}
.indent{padding-left:14px;color:#6f6658;font-size:11px}
.mini-pill{display:inline-block;padding:1px 7px;border-radius:3px;background:#ece5d7;color:#6f6658;font-size:10px;margin:1px;font-weight:600;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.3px}
.slot-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.slot{background:#fcf9f3;border:1px solid #ece5d7;border-radius:6px;padding:8px;font-size:11px}
.slot-n{display:inline-block;width:18px;height:18px;border-radius:50%;background:#c0492a;color:#fff;font-size:10px;font-weight:700;text-align:center;line-height:18px;margin-right:6px}
.slot-l{display:inline-block;font-weight:700;font-size:10.5px;text-transform:uppercase;color:#c0492a;letter-spacing:.4px}
.slot-p{font-size:11px;color:#23201a;font-weight:500;margin:4px 0}
.slot-row{font-size:10px;color:#6f6658;margin-top:2px}

/* Product grid */
.prod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px}
.prod-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;overflow:hidden;transition:border-color .12s,transform .12s}
.prod-card:hover{border-color:#c0492a}
.prod-card[hidden]{display:none}
.prod-hdr{display:grid;grid-template-columns:90px 1fr 56px;gap:12px;padding:14px;border-bottom:1px solid #ece5d7;align-items:start}
.prod-photo{width:90px;height:90px;background:#fff;border:1px solid #ece5d7;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.prod-photo img{width:100%;height:100%;object-fit:contain;padding:6px}
.prod-info{min-width:0;display:flex;flex-direction:column;gap:4px}
.prod-brand-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.brand-circle{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:'Archivo'}
.brand-label{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:#23201a;font-weight:700}
.asin{font-family:'JetBrains Mono',monospace;font-size:9px;color:#a89e8d;letter-spacing:.4px}
.vol-pill{display:inline-block;padding:2px 7px;border-radius:3px;background:#dceede;color:#2c7a3e;font-size:9px;font-weight:700;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.3px;margin-left:auto}
.prod-name{font-size:13.5px;font-weight:600;color:#23201a;line-height:1.35;max-height:38px;overflow:hidden}
.prod-price-row{display:flex;align-items:baseline;gap:10px;margin-top:2px}
.price-big{font-size:21px;font-weight:800;color:#23201a;font-variant-numeric:tabular-nums}
.rating-row{font-size:12px;color:#8a5a00;font-weight:600}
.badge-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.3px}
.badge-best{background:#f4e4c4;color:#8a5a00}
.badge-choice{background:#e6e3f0;color:#5a4e8f}
.badge-prime{background:#dceede;color:#2c7a3e}
.prod-tier{border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 0}
.tier-num{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
.tier-lbl{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.5px;font-weight:700;margin-top:3px}

.prod-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 14px;background:#fff;border-bottom:1px solid #ece5d7}
.metric{display:flex;flex-direction:column;gap:2px}

.prod-gen,.prod-supp{padding:12px 14px;border-bottom:1px solid #ece5d7;position:relative}
.prod-gen{background:#fff}
.prod-supp{background:#fcf9f3}
.prod-gen.empty{display:flex;justify-content:space-between;align-items:center}
.gen-strip{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px}
.gen-tile{position:relative;aspect-ratio:9/16;border-radius:4px;overflow:hidden;display:block;background:#ece5d7;border:1px solid #dad0bf}
.gen-tile img{width:100%;height:100%;object-fit:cover;transition:transform .2s}
.gen-tile:hover img{transform:scale(1.04)}
.gen-tag{position:absolute;bottom:3px;left:3px;background:rgba(35,32,26,.85);color:#fff;font-size:8.5px;padding:2px 6px;border-radius:3px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;font-family:'JetBrains Mono',monospace}
.regen-mini{position:absolute;top:8px;right:8px;background:transparent;color:#c0492a;border:1px solid #c0492a;border-radius:50%;width:24px;height:24px;font-size:12px;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center}
.regen-mini:hover{background:#c0492a;color:#fff}
.regen-mini.big{position:static;width:auto;height:auto;padding:5px 12px;border-radius:6px;font-size:11px;font-family:'Archivo';font-weight:700}
.supp-row{display:grid;grid-template-columns:64px 1fr;gap:10px;margin-top:6px}
.supp-photo{width:64px;height:64px;background:#fff;border:1px solid #ece5d7;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:24px}
.supp-photo img{width:100%;height:100%;object-fit:contain;padding:4px}
.supp-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.supp-name{font-size:11.5px;font-weight:600;color:#23201a;line-height:1.35;max-height:30px;overflow:hidden}
.supp-meta{font-size:10px;color:#6f6658}
.supp-pills{display:flex;flex-wrap:wrap;gap:4px}
.sp{padding:1px 6px;border-radius:3px;background:#f4e4c4;color:#8a5a00;font-size:9.5px;font-weight:700;font-family:'JetBrains Mono',monospace;letter-spacing:.3px}
.sp-usd{background:#dceede;color:#2c7a3e}
.sp-conf{background:#ece5d7;color:#6f6658}
.src-link{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#c0492a;font-weight:600}
.src-link:hover{text-decoration:underline}
.src-link.mono{font-size:10px;color:#a89e8d}
.prod-foot{padding:8px 14px;background:#fcf9f3}

/* Concepts */
.concepts-section{margin-top:48px}
.lane-concept-block{margin-bottom:32px;animation:rise .5s ease both}
.lane-concept-hdr{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.lane-aud{font-size:11.5px;color:#6f6658}
.concept-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:1100px){.concept-grid{grid-template-columns:1fr}}
.concept-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;padding:20px}
.concept-card.pending{background:transparent;border-style:dashed}
.concept-kicker{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:#a89e8d;font-weight:700;margin-bottom:4px}
.concept-name{font-family:'Newsreader',serif;font-weight:500;font-size:26px;color:#23201a;letter-spacing:-.3px}
.concept-tag{font-family:'Newsreader',serif;font-style:italic;font-size:14px;color:#c0492a;margin-top:2px}
.concept-phil{font-size:12px;color:#6f6658;margin:10px 0 14px;line-height:1.6}
.palette{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:5px;margin-bottom:14px}
.sw{padding:10px 8px;border-radius:5px;text-align:center}
.sw-name{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
.sw-hex{font-family:'JetBrains Mono',monospace;font-size:9px;opacity:.85;margin-top:1px}
.typo-preview{background:#fff;border:1px solid #ece5d7;border-radius:6px;padding:14px;margin-bottom:14px}
.typo-sample{font-size:24px;color:#23201a;line-height:1.2}
.typo-body{font-size:12px;color:#6f6658;margin-top:6px;line-height:1.5}
.dodont{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}

/* Shop identities */
.logos-section{margin-top:48px}
.shop-gallery{display:grid;grid-template-columns:1fr;gap:14px}
.shop-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;display:grid;grid-template-columns:320px 1fr;gap:18px;overflow:hidden}
.shop-card.pending{grid-template-columns:1fr;padding:24px;text-align:center;color:#6f6658}
.shop-card-logo{display:block;background:#fff;border-right:1px solid #ece5d7;aspect-ratio:3/2;display:flex;align-items:center;justify-content:center;overflow:hidden}
.shop-card-logo img{width:100%;height:100%;object-fit:contain;padding:18px}
.shop-card-logo.pending{font-size:11px;color:#a89e8d;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.5px}
.shop-card-meta{padding:18px 20px}
.shop-name{font-family:'Newsreader',serif;font-weight:500;font-size:28px;letter-spacing:-.4px;color:#23201a;margin:4px 0 2px}
.shop-tag{font-family:'Newsreader',serif;font-style:italic;font-size:14px;color:#c0492a;margin-bottom:10px}
.shop-meta-row{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0;align-items:center}
.shop-meta-row.small{font-size:11px}
.shop-arch{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.6px;text-transform:uppercase;font-weight:700;background:#c0492a;color:#fff;padding:3px 8px;border-radius:3px}
.shop-typo,.shop-voice{font-size:11px;color:#6f6658}
.shop-palette{display:flex;gap:4px;margin:10px 0 8px;flex-wrap:wrap}
.sh-sw{padding:4px 8px;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;border-radius:3px;letter-spacing:.3px}
.shop-rationale{font-size:11.5px;color:#6f6658;line-height:1.5;margin-top:4px;font-style:italic}

/* Shop identity (inline in niche header) */
.shop-identity{display:grid;grid-template-columns:180px 1fr;gap:16px;background:#fff;border:1px solid #dad0bf;border-radius:8px;padding:16px;margin-bottom:18px}
.shop-logo-col{display:flex;align-items:center;justify-content:center}
.shop-logo-frame{aspect-ratio:3/2;width:100%;background:#fcf9f3;border:1px solid #ece5d7;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#a89e8d;font-size:10px;font-family:'JetBrains Mono',monospace;text-transform:uppercase}
.shop-logo-frame img{width:100%;height:100%;object-fit:contain;padding:8px}
.shop-id-col{display:flex;flex-direction:column;justify-content:center}

/* Shops */
.shops-section{margin-top:48px}
.shop-grid{display:grid;grid-template-columns:1fr;gap:16px}
.shop-tile{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;overflow:hidden}
.shop-hdr{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid #dad0bf}
.shop-hdr h3{font-family:'Newsreader',serif;font-weight:500;font-size:18px;color:#23201a}
.open-link{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#c0492a;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.shop-tile iframe{width:100%;height:560px;border:0;display:block;background:#fff}

/* Inspiration */
.insp-section{margin-top:48px}
.insp-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:6px;margin-bottom:10px}
.insp-card summary{cursor:pointer;padding:12px 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.insp-card[open] summary{border-bottom:1px solid #dad0bf}
.arch{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#c0492a;text-transform:uppercase;letter-spacing:.5px}
.insp-body{padding:16px}
.ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:12px}
.ref-card{background:#fff;border:1px solid #ece5d7;border-radius:5px;padding:10px;font-size:11px}
.ref-name{font-weight:700;color:#23201a;font-size:12px}
.ref-vibe{color:#c0492a;font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin:2px 0;font-family:'JetBrains Mono',monospace}
.ref-why{color:#6f6658;font-size:11px;line-height:1.4}
.layout-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11.5px;margin-bottom:12px}
.layout-grid > div{background:#fff;padding:8px;border-radius:5px;border:1px solid #ece5d7}

.empty-block{background:#fcf9f3;border:1px dashed #d8cfbe;border-radius:6px;padding:24px;text-align:center;color:#6f6658;font-size:13px;line-height:1.7}

footer{margin-top:60px;padding-top:18px;border-top:1px solid #dad0bf;font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d;text-align:center;line-height:1.8;letter-spacing:.3px}

/* List view (alternative) */
body.view-list .prod-grid{grid-template-columns:1fr}
body.view-list .prod-card{display:grid;grid-template-columns:300px 1fr}
body.view-list .prod-hdr{border-right:1px solid #ece5d7;border-bottom:0}
body.view-compare .prod-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
body.view-compare .prod-metrics{grid-template-columns:repeat(2,1fr)}

/* Click-to-expand lightbox — every <img> is clickable */
img{cursor:zoom-in}
#imgLb{position:fixed;inset:0;background:rgba(20,18,14,.92);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;animation:lbFade .18s}
#imgLb.open{display:flex}
#imgLb img{max-width:96vw;max-height:92vh;cursor:zoom-out;box-shadow:0 32px 80px rgba(0,0,0,.6);border-radius:6px;background:#fcf9f3}
#imgLb .lb-meta{position:absolute;top:18px;left:24px;color:#fcf9f3;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.4px;max-width:60vw;text-shadow:0 1px 4px rgba(0,0,0,.6)}
#imgLb .lb-close{position:absolute;top:18px;right:24px;color:#fcf9f3;font-size:24px;line-height:1;cursor:pointer;background:rgba(255,255,255,.1);width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}
#imgLb .lb-close:hover{background:rgba(255,255,255,.22)}
#imgLb .lb-open{position:absolute;bottom:20px;right:24px;color:#fcf9f3;font-family:inherit;font-size:12px;background:rgba(192,73,42,.9);padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:600}
@keyframes lbFade{from{opacity:0}to{opacity:1}}
</style>
</head>
<body>
<div class="wrap">

${renderMasthead()}
${renderKpiBand()}
${renderToolbar()}
${renderLeaderboard()}
${renderComparisonTable()}

${Object.entries(byNiche).map(([id, cands]) => renderNicheBlock(id, cands)).join('')}

${renderConcepts()}
${renderLogos()}
${renderShops()}
${renderInspiration()}

<footer>
  Generated by <code>render-master-view.mjs</code> · ${candidates.length} candidates · ${suppliers.length} suppliers · ${Object.values(genIndex).reduce((s,g)=>s+(g.assets?.length||0),0)} gen assets · ${Object.keys(logoIndex).length} logo sets<br>
  Real RapidAPI (Amazon + Taobao) · Replicate flux-1.1-pro-ultra · OpenAI gpt-4o-mini + Google gemini-2.5-flash<br>
  Re-render: <code>node packages/capabilities/product-intelligence/scripts/render-master-view.mjs</code>
</footer>
</div>

<script>
// ===== TOOLBAR INTERACTION =====
const state = { tab: 'all', search: '', sort: 'comp', filters: { profitable: false, hasSupplier: false, hasMedia: false, prime: false }, marginMin: -50, view: 'grid' };

function applyFilters() {
  const cards = document.querySelectorAll('.prod-card');
  let vis = 0;
  cards.forEach(card => {
    const niche = card.closest('.niche-block')?.dataset?.niche;
    const tier = card.dataset.tier;
    const margin = parseFloat(card.dataset.margin);
    const hasMedia = card.dataset.hasmedia === 'true';
    const hasSupplier = card.dataset.hassupplier === 'true';
    const prime = card.dataset.prime === 'true';
    const name = card.dataset.name;
    let show = true;
    if (state.tab !== 'all' && niche !== state.tab) show = false;
    if (state.search && !name.includes(state.search.toLowerCase())) show = false;
    if (state.filters.profitable && margin <= 0) show = false;
    if (state.filters.hasSupplier && !hasSupplier) show = false;
    if (state.filters.hasMedia && !hasMedia) show = false;
    if (state.filters.prime && !prime) show = false;
    if (margin < state.marginMin / 100) show = false;
    card.hidden = !show;
    if (show) vis++;
  });
  document.getElementById('visCount').textContent = vis;
  // Hide niche blocks if no visible cards under them
  document.querySelectorAll('.niche-block').forEach(nb => {
    const anyVisible = nb.querySelectorAll('.prod-card:not([hidden])').length > 0;
    nb.style.display = (state.tab === 'all' || state.tab === nb.dataset.niche) && anyVisible ? '' : 'none';
  });
}

function applySort() {
  document.querySelectorAll('.prod-grid').forEach(grid => {
    const cards = [...grid.children];
    cards.sort((a, b) => {
      const va = getVal(a, state.sort);
      const vb = getVal(b, state.sort);
      return vb - va;
    });
    cards.forEach(c => grid.appendChild(c));
  });
}
function getVal(card, key) {
  if (key === 'margin') return parseFloat(card.dataset.margin) || 0;
  if (key === 'comp') return parseInt(card.querySelector('.tier-num')?.textContent) || 0;
  if (key === 'price') return parseFloat(card.querySelector('.price-big')?.textContent.replace(/[^0-9.]/g, '')) || 0;
  if (key === 'rating') return parseFloat(card.querySelector('.rating-row')?.textContent.match(/[\\d.]+/)?.[0]) || 0;
  if (key === 'reviews') {
    const m = card.querySelector('.rating-row .muted')?.textContent.match(/[\\d,]+/);
    return m ? parseInt(m[0].replace(/,/g, '')) : 0;
  }
  if (key === 'revenue') {
    const t = card.querySelector('.prod-metrics .metric .m-val')?.textContent || '';
    const n = parseFloat(t.replace(/[$,M]/g, '')) || 0;
    return t.includes('M') ? n * 1_000_000 : n;
  }
  return 0;
}

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  state.tab = t.dataset.tab;
  applyFilters();
}));
document.getElementById('searchInput').addEventListener('input', (e) => { state.search = e.target.value; applyFilters(); });
document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; applySort(); });
document.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
  ch.classList.toggle('active');
  state.filters[ch.dataset.filter] = ch.classList.contains('active');
  applyFilters();
}));
document.getElementById('marginRange').addEventListener('input', (e) => {
  state.marginMin = parseInt(e.target.value);
  document.getElementById('marginRangeVal').textContent = state.marginMin <= -50 ? 'any' : (state.marginMin + '%');
  applyFilters();
});
document.querySelectorAll('.view-btn').forEach(v => v.addEventListener('click', () => {
  document.querySelectorAll('.view-btn').forEach(x => x.classList.remove('active'));
  v.classList.add('active');
  document.body.className = 'view-' + v.dataset.view;
  state.view = v.dataset.view;
}));
document.getElementById('expandAll').addEventListener('click', () => {
  const open = document.getElementById('expandAll').textContent.startsWith('Expand');
  document.querySelectorAll('details').forEach(d => d.open = open);
  document.getElementById('expandAll').textContent = open ? 'Collapse all' : 'Expand all';
});

// REGEN HOOKS (display intent — actual regen runs server-side)
function regenerateOne(candidateId) {
  alert('Regen single candidate: ' + candidateId + '\\n\\nRun: node packages/capabilities/media-generation/scripts/batch-generate-from-candidates.mjs --regen');
}
function regenerateConcepts() {
  alert('Run: node packages/capabilities/product-intelligence/scripts/research-with-openai.mjs && node packages/capabilities/product-intelligence/scripts/research-with-gemini.mjs');
}
function regenerateLogos() {
  alert('Run: node packages/capabilities/media-generation/scripts/generate-logos.mjs');
}
function regenerateShops() {
  alert('Re-dispatch codex via: codex-yolo --background --file <brief.txt> --cwd C:/Code/CODE_MODULE_LIBRARY');
}
document.getElementById('regenBtn').addEventListener('click', () => {
  alert('Full pipeline regen:\\n\\n1. pull-trends.mjs (real RapidAPI)\\n2. batch-generate-from-candidates.mjs (Replicate)\\n3. research-with-openai.mjs + research-with-gemini.mjs (LLMs)\\n4. generate-logos.mjs (Replicate)\\n5. render-master-view.mjs (this view)');
});

// ===== Image lightbox — click any <img> to expand =====
(function(){
  const lb = document.createElement('div');
  lb.id = 'imgLb';
  lb.innerHTML = '<div class="lb-meta" id="lbMeta"></div><div class="lb-close" id="lbClose">✕</div><img id="lbImg" alt=""><a class="lb-open" id="lbOpenNew" target="_blank" rel="noopener">Open in new tab ↗</a>';
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('#lbImg');
  const lbMeta = lb.querySelector('#lbMeta');
  const lbOpen = lb.querySelector('#lbOpenNew');
  function open(src, alt){
    lbImg.src = src;
    lbImg.alt = alt || '';
    lbMeta.textContent = alt || src.split('/').slice(-1)[0];
    lbOpen.href = src;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close(){
    lb.classList.remove('open');
    lbImg.src = '';
    document.body.style.overflow = '';
  }
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img || img.closest('#imgLb')) return;
    // If image is wrapped in <a target="_blank">, suppress the new-tab open and lightbox instead
    const a = img.closest('a');
    if (a) e.preventDefault();
    open(img.currentSrc || img.src, img.alt);
  });
  lb.addEventListener('click', (e) => {
    if (e.target === lb || e.target.id === 'lbClose' || e.target === lbImg) close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lb.classList.contains('open')) close(); });
})();
</script>
</body>
</html>`;

fs.writeFileSync(OUT_HTML, html);
console.log(`wrote ${(html.length/1024).toFixed(1)}KB to ${OUT_HTML}`);
console.log(`candidates:${candidates.length} suppliers:${suppliers.length} gen-assets:${Object.values(genIndex).reduce((s,g)=>s+(g.assets?.length||0),0)} logos:${Object.values(logoIndex).reduce((s,l)=>s+(l.assets?.length||0),0)} shop-logos:${Object.keys(shopLogoIndex).length} shop-concepts:${Object.keys(shopConcepts).length} shops:${shopPreviews.length}`);
// Auto-publish render to R2
const up = await tryPutR2('mjb/views/mjb-master-view.html', OUT_HTML);
console.log(up.ok ? `→ R2: ${up.publicUrl}` : `→ R2 upload failed: ${up.error}`);
