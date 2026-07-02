#!/usr/bin/env node
/**
 * render-design-lab.mjs — renders the MJB Design Lab HTML view from the
 * LLM research files under mockups/real-trends/research/. Shows:
 *
 *   - Trends deep-dive per niche (market sentiment, growth, sub-trends,
 *     keywords by intent, competition, seasonality, pain points)
 *   - UGC best practices per niche (image breakdown, short-form video,
 *     description practices, differentiators, mistakes)
 *   - Shop design inspiration per brand lane (archetype, references,
 *     layout patterns, trust elements, CTA style, mobile)
 *   - Design concepts per brand lane (palette + typography + components
 *     + voice/tone + differentiating details). Side-by-side OpenAI vs
 *     Gemini once Gemini outputs land.
 *   - Codex shop preview iframes once they land.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const RESEARCH_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends', 'research');
const OUT_HTML = path.join(REPO_ROOT, 'mockups', 'design-lab.html');
const SHOP_PREVIEWS_DIR = path.join(REPO_ROOT, 'mockups', 'shop-previews');

function loadJsonSafe(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const trends = loadJsonSafe(path.join(RESEARCH_DIR, 'trends-deep-dive.json'));
const ugc = loadJsonSafe(path.join(RESEARCH_DIR, 'ugc-best-practices.json'));
const inspiration = loadJsonSafe(path.join(RESEARCH_DIR, 'shop-design-inspiration.json'));
const conceptsOpenAI = loadJsonSafe(path.join(RESEARCH_DIR, 'design-concepts-openai.json'));
const conceptsGemini = loadJsonSafe(path.join(RESEARCH_DIR, 'design-concepts-gemini.json'));
const brandLanes = loadJsonSafe(path.join(REPO_ROOT, 'config', 'mjb', 'brand-lanes.json'));

const lanes = brandLanes?.lanes || [];
const lanesById = Object.fromEntries(lanes.map(l => [l.laneId, l]));
const nicheIds = trends ? Object.keys(trends.results || {}) : [];

const shopPreviews = fs.existsSync(SHOP_PREVIEWS_DIR)
  ? fs.readdirSync(SHOP_PREVIEWS_DIR).filter(f => f.endsWith('.html'))
  : [];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtNum = (n) => n == null ? '—' : Number(n).toLocaleString();
function nicheLabel(id) { return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); }
function laneClass(id) { return ({'mjb-home-finds':'lane-home','mjb-tech-finds':'lane-tech','mjb-everyday-utility':'lane-utility'})[id] || 'lane-other'; }

// =====================================================================
// Section: TRENDS DEEP DIVE
// =====================================================================
function renderTrendsSection() {
  if (!trends) return '';
  const tier = (v) => `<span class="pill tier-${(v||'').toLowerCase()}">${esc(v)}</span>`;
  const cards = Object.entries(trends.results).map(([nicheId, t]) => {
    if (t.error) return `<div class="trend-card error">${esc(nicheId)}: ${esc(t.error)}</div>`;
    return `
    <div class="trend-card">
      <div class="trend-head">
        <h3>${nicheLabel(nicheId)}</h3>
        <div class="trend-chips">
          ${tier(t.marketSentiment)}
          ${tier(t.growthTrajectory)}
          ${tier(t.competitionAnalysis?.tier)}
        </div>
      </div>
      <div class="trend-key-metric">
        <span class="kpi-num">${fmtNum(t.estimatedSearchVolumeMonthly)}</span>
        <span class="kpi-label">est. monthly searches</span>
      </div>
      <p class="trend-quote">${esc(t.sentimentReasoning)}</p>

      <div class="trend-row">
        <div class="trend-half">
          <div class="trend-section-label">🌱 Emerging sub-trends</div>
          <ul class="bullets">
            ${(t.topEmergingSubTrends || []).map(s => `
              <li><b>${esc(s.subTrend)}</b> <span class="conf conf-${s.confidence}">${esc(s.confidence)}</span><br><span class="muted">${esc(s.evidenceFromData)}</span></li>
            `).join('')}
          </ul>
        </div>
        <div class="trend-half">
          <div class="trend-section-label">🎯 Audience pain points</div>
          <ul class="bullets">
            ${(t.audiencePainPoints || []).map(p => `<li>${esc(p)}</li>`).join('')}
          </ul>
          <div class="trend-section-label" style="margin-top:14px">📅 Seasonality</div>
          <div class="trend-tag">${esc(t.seasonality)}</div>
        </div>
      </div>

      <div class="keyword-block">
        <div class="trend-section-label">🔑 Keywords by buyer intent</div>
        <div class="kw-grid">
          <div class="kw-group"><div class="kw-label">Buying intent</div><div class="kw-tags">${(t.topKeywordsByIntent?.buying || []).map(k => `<span class="kw kw-buy">${esc(k)}</span>`).join('')}</div></div>
          <div class="kw-group"><div class="kw-label">Research intent</div><div class="kw-tags">${(t.topKeywordsByIntent?.research || []).map(k => `<span class="kw kw-research">${esc(k)}</span>`).join('')}</div></div>
          <div class="kw-group"><div class="kw-label">Comparison</div><div class="kw-tags">${(t.topKeywordsByIntent?.comparison || []).map(k => `<span class="kw kw-compare">${esc(k)}</span>`).join('')}</div></div>
        </div>
      </div>

      <div class="comp-analysis">
        <div class="trend-section-label">⚔ Competition</div>
        <p class="muted"><b>Barrier to entry:</b> ${esc(t.competitionAnalysis?.barrierToEntry)}</p>
        <div class="trend-section-label" style="margin-top:8px">✅ Differentiators that still work</div>
        <ul class="bullets">
          ${(t.competitionAnalysis?.differentiatorsThatStillWork || []).map(d => `<li>${esc(d)}</li>`).join('')}
        </ul>
      </div>
    </div>`;
  }).join('');
  return `
  <section id="trends" class="lab-section">
    <div class="section-head">
      <h2>📈 Trends Deep-Dive</h2>
      <div class="section-sub">10 niches · GPT-4o-mini analysis over real Amazon data (top 10 candidates per niche)</div>
    </div>
    <div class="trend-grid">${cards}</div>
  </section>`;
}

// =====================================================================
// Section: UGC BEST PRACTICES
// =====================================================================
function renderUgcSection() {
  if (!ugc) return '';
  const tabs = Object.keys(ugc.results).map((nicheId, i) =>
    `<button class="tab ${i === 0 ? 'active' : ''}" data-tab="ugc-${nicheId}">${nicheLabel(nicheId)}</button>`).join('');
  const panels = Object.entries(ugc.results).map(([nicheId, u], i) => {
    if (u.error) return `<div class="tab-panel ${i === 0 ? 'active' : ''}" data-panel="ugc-${nicheId}">${esc(u.error)}</div>`;
    const ali = u.amazonListingImages;
    const sfv = u.shortFormVideoUgc;
    const pdp = u.productDescriptionPractices;
    return `
    <div class="tab-panel ${i === 0 ? 'active' : ''}" data-panel="ugc-${nicheId}">
      <div class="ugc-grid">

        <div class="ugc-card">
          <div class="ugc-head">📸 Amazon listing image strategy</div>
          <div class="ugc-meta">Recommended count: <b>${ali?.recommendedCount ?? '—'}</b> · Dims: ${esc(ali?.mustHaveDimensions)}</div>
          <div class="ugc-meta">Background: ${esc(ali?.backgroundConvention)}</div>
          <div class="slot-grid">
            ${(ali?.imageBreakdown || []).map((s, idx) => `
              <div class="slot">
                <div class="slot-num">${idx + 1}</div>
                <div class="slot-label">${esc(s.slot)}</div>
                <div class="slot-purpose">${esc(s.purpose)}</div>
                <div class="slot-row"><b>Light:</b> ${esc(s.lightingNotes)}</div>
                <div class="slot-row"><b>Comp:</b> ${esc(s.compositionNotes)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="ugc-card">
          <div class="ugc-head">📱 Short-form video UGC</div>
          <div class="ugc-row"><b>Ideal length:</b> ${sfv?.idealLengthSec}s · <b>Hashtags:</b> ${sfv?.hashtagCount}</div>
          <div class="ugc-row"><b>Opening hook styles:</b> ${(sfv?.openingHookStyles || []).map(h => `<span class="pill">${esc(h)}</span>`).join(' ')}</div>
          <div class="ugc-row"><b>Lighting:</b><br>${(sfv?.lightingRecommendations || []).map(l => `<div class="indent">▸ ${esc(l)}</div>`).join('')}</div>
          <div class="ugc-row"><b>Audio:</b> ${esc(sfv?.audioStyle)}</div>
          <div class="ugc-row"><b>Caption style:</b> ${esc(sfv?.captionStyle)}</div>
        </div>

        <div class="ugc-card">
          <div class="ugc-head">📝 Product description practices</div>
          <div class="ugc-row"><b>Title chars:</b> ${esc(pdp?.titleCharRange)}</div>
          <div class="ugc-row"><b>Title structure:</b> <code>${esc(pdp?.titleStructure)}</code></div>
          <div class="ugc-row"><b>Bullets:</b> ${pdp?.bulletPoints?.count}× @ ${esc(pdp?.bulletPoints?.lengthPerBulletWords)} words<br>Lead with: ${pdp?.bulletPoints?.leadWithBenefit ? 'benefit' : 'feature'}, follow with: ${pdp?.bulletPoints?.followWithFeature ? 'feature' : 'benefit'}</div>
          <div class="ugc-row"><b>A+ content:</b> ${pdp?.aPlusContentRecommended ? '✅ recommended' : '⚠ optional'}</div>
          <div class="ugc-row"><b>Keyword density:</b> ${esc(pdp?.keywordDensity)}</div>
          <div class="ugc-row"><b>Voice & tone:</b> ${esc(pdp?.voiceAndTone)}</div>
        </div>

        <div class="ugc-card ugc-do-dont">
          <div class="ugc-head">⚙ Differentiator plays</div>
          <ul class="bullets bullets-good">${(u.differentiatorPlays || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
          <div class="ugc-head" style="margin-top:18px">❌ Common mistakes</div>
          <ul class="bullets bullets-bad">${(u.commonMistakes || []).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
        </div>

      </div>
    </div>`;
  }).join('');
  return `
  <section id="ugc" class="lab-section">
    <div class="section-head">
      <h2>🎬 UGC Best Practices</h2>
      <div class="section-sub">Per-niche image strategy, short-form video setup, description practices, do/don't lists</div>
    </div>
    <div class="tabs" data-tab-group="ugc">${tabs}</div>
    <div class="tab-panels" data-tab-panels="ugc">${panels}</div>
  </section>`;
}

// =====================================================================
// Section: SHOP DESIGN INSPIRATION
// =====================================================================
function renderInspirationSection() {
  if (!inspiration) return '';
  const cards = Object.entries(inspiration.results).map(([laneId, ins]) => {
    if (ins.error) return '';
    const lane = lanesById[laneId];
    return `
    <div class="ins-card">
      <div class="ins-head">
        <span class="pill ${laneClass(laneId)}">${esc(lane?.displayName || laneId)}</span>
        <div class="archetype">${esc(ins.designArchetype)}</div>
      </div>
      <p class="ins-reasoning">${esc(ins.archetypeReasoning)}</p>
      <div class="ins-sub-head">🔗 Reference sites by vibe</div>
      <div class="ref-grid">
        ${(ins.referenceSitesByVibe || []).map(r => `
          <div class="ref-card">
            <div class="ref-name">${esc(r.siteName)}</div>
            <div class="ref-vibe">${esc(r.vibe)}</div>
            <div class="ref-why">${esc(r.whyRelevant)}</div>
          </div>
        `).join('')}
      </div>
      <div class="ins-sub-head">🧩 Layout patterns</div>
      <div class="layout-grid">
        <div><span class="lk">Hero</span><span class="lv">${esc(ins.layoutPatterns?.homepageHeroPattern)}</span></div>
        <div><span class="lk">Product grid</span><span class="lv">${esc(ins.layoutPatterns?.productGridPattern)}</span></div>
        <div><span class="lk">Product detail</span><span class="lv">${esc(ins.layoutPatterns?.productDetailPattern)}</span></div>
        <div><span class="lk">Checkout</span><span class="lv">${esc(ins.layoutPatterns?.checkoutPattern)}</span></div>
      </div>
      <div class="ins-sub-head">🛡 Trust elements</div>
      <div class="chip-row">${(ins.trustElements || []).map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>
      <div class="ins-sub-head">📲 CTA & navigation</div>
      <div class="layout-grid">
        <div><span class="lk">Primary CTA</span><span class="lv">${esc(ins.ctaStyle?.primaryButton)}</span></div>
        <div><span class="lk">Secondary CTA</span><span class="lv">${esc(ins.ctaStyle?.secondaryButton)}</span></div>
        <div><span class="lk">Microcopy voice</span><span class="lv">${esc(ins.ctaStyle?.microcopyVoice)}</span></div>
        <div><span class="lk">Navigation</span><span class="lv">${esc(ins.navigationPattern)}</span></div>
      </div>
      <div class="ins-sub-head">📷 Imagery direction</div>
      <p class="muted">${esc(ins.imageryDirection)}</p>
      <div class="ins-sub-head">📱 Mobile-first considerations</div>
      <ul class="bullets">${(ins.mobileFirstConsiderations || []).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
    </div>`;
  }).join('');
  return `
  <section id="inspiration" class="lab-section">
    <div class="section-head">
      <h2>🏛 Shop Design Inspiration</h2>
      <div class="section-sub">Per brand-lane: archetype + 5-6 reference sites + layout patterns + CTA conventions + mobile considerations</div>
    </div>
    <div class="ins-grid">${cards}</div>
  </section>`;
}

// =====================================================================
// Section: DESIGN CONCEPTS (OpenAI + future Gemini side-by-side)
// =====================================================================
function renderColorSwatch(color) {
  return `
    <div class="swatch" style="background:${esc(color.hex)}; color:${getContrast(color.hex)}">
      <div class="swatch-name">${esc(color.name)}</div>
      <div class="swatch-hex">${esc(color.hex)}</div>
      <div class="swatch-usage">${esc(color.usage)}</div>
    </div>`;
}

function getContrast(hex) {
  const c = hex.replace('#','');
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.55 ? '#000' : '#fff';
}

function renderConcept(laneId, concept, source) {
  if (!concept || concept.error) return '';
  const c = concept;
  const palette = Object.entries(c.colorPalette || {}).map(([key, val]) => renderColorSwatch(val)).join('');
  const typo = c.typography || {};
  const fontLinks = [typo.displayFont?.name, typo.bodyFont?.name, typo.monoFont?.name]
    .filter(Boolean)
    .filter(n => n !== 'Inter' && n !== 'JetBrains Mono')
    .map(n => `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(n).replace(/%20/g,'+')}:wght@400;500;600;700;900&display=swap" rel="stylesheet">`)
    .join('');
  const exampleStyle = `
    --concept-primary: ${c.colorPalette?.primary?.hex};
    --concept-secondary: ${c.colorPalette?.secondary?.hex};
    --concept-accent: ${c.colorPalette?.accent?.hex};
    --concept-bg: ${c.colorPalette?.background?.hex};
    --concept-neutral-dark: ${c.colorPalette?.neutralDark?.hex};
    --concept-neutral-light: ${c.colorPalette?.neutralLight?.hex};
    --concept-display-font: ${JSON.stringify(typo.displayFont?.name || 'Inter')};
    --concept-body-font: ${JSON.stringify(typo.bodyFont?.name || 'Inter')};
  `.replace(/\s+/g, ' ');
  return `
    ${fontLinks}
    <div class="concept-card" style="${esc(exampleStyle)}">
      <div class="concept-head">
        <div>
          <div class="concept-source">${esc(source)}</div>
          <h3 class="concept-name">${esc(c.conceptName)}</h3>
          <p class="concept-tagline">${esc(c.conceptTagline)}</p>
        </div>
      </div>
      <p class="concept-philosophy">${esc(c.designPhilosophy)}</p>

      <div class="concept-section-label">🎨 Color palette</div>
      <div class="palette-grid">${palette}</div>

      <div class="concept-section-label">🔤 Typography</div>
      <div class="typo-row">
        <div class="typo-card">
          <div class="typo-label">Display · ${esc(typo.displayFont?.name)}</div>
          <div class="typo-preview display-preview" style="font-family:var(--concept-display-font);font-weight:900">Aa <span class="typo-sample">The quick brown fox</span></div>
        </div>
        <div class="typo-card">
          <div class="typo-label">Body · ${esc(typo.bodyFont?.name)}</div>
          <div class="typo-preview" style="font-family:var(--concept-body-font);font-weight:400">Aa <span class="typo-sample">The quick brown fox jumps over the lazy dog</span></div>
        </div>
        <div class="typo-card">
          <div class="typo-label">Mono · ${esc(typo.monoFont?.name)}</div>
          <div class="typo-preview" style="font-family:var(--concept-mono-font, 'JetBrains Mono', monospace)">Aa <span class="typo-sample">const x = 42; // works</span></div>
        </div>
      </div>
      <div class="typo-meta muted">Scale ratio ${typo.scaleRatio} · Baseline ${typo.baselineSize}px</div>

      <div class="concept-section-label">📏 Spacing tokens</div>
      <div class="spacing-row">
        ${Object.entries(c.spacingTokens || {}).map(([k,v]) => `<div class="spacing-cell"><div class="sp-box" style="width:${v}px;height:${v}px"></div><div class="sp-label">${esc(k)} ${v}px</div></div>`).join('')}
      </div>

      <div class="concept-section-label">🧱 Component preview</div>
      <div class="component-preview" style="background:var(--concept-bg);color:var(--concept-neutral-dark);padding:24px;border-radius:${esc(c.componentStyle?.cardRadius || '12px')};box-shadow:${esc(c.componentStyle?.cardShadow || '0 4px 16px rgba(0,0,0,.06)')}">
        <div style="font-family:var(--concept-display-font);font-weight:900;font-size:28px;margin-bottom:6px">${esc(c.voiceAndTone?.exampleHeadline)}</div>
        <div style="font-family:var(--concept-body-font);font-size:14px;line-height:1.5;color:var(--concept-neutral-dark);opacity:.7;margin-bottom:16px">${esc(c.voiceAndTone?.exampleProductCopy)}</div>
        <button style="background:var(--concept-primary);color:white;border:0;padding:12px 24px;border-radius:${esc(c.componentStyle?.buttonRadius || '6px')};box-shadow:${esc(c.componentStyle?.buttonShadow || 'none')};font-weight:700;cursor:pointer;font-family:var(--concept-body-font)">Get yours →</button>
        <button style="background:transparent;color:var(--concept-primary);border:1px solid var(--concept-primary);padding:12px 24px;border-radius:${esc(c.componentStyle?.buttonRadius || '6px')};margin-left:8px;font-weight:600;cursor:pointer;font-family:var(--concept-body-font)">Learn more</button>
      </div>

      <div class="concept-section-label">🗣 Voice & tone</div>
      <p class="muted"><b>Writing style:</b> ${esc(c.voiceAndTone?.writingStyle)}</p>
      <div class="dodont-row">
        <div class="dodont-col">
          <div class="dodont-head good">DO SAY</div>
          <ul class="bullets bullets-good">${(c.voiceAndTone?.doSayList || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        </div>
        <div class="dodont-col">
          <div class="dodont-head bad">DON'T SAY</div>
          <ul class="bullets bullets-bad">${(c.voiceAndTone?.dontSayList || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        </div>
      </div>

      <div class="concept-section-label">✨ Differentiating details</div>
      <ul class="bullets">${(c.differentiatingDetails || []).map(d => `<li>${esc(d)}</li>`).join('')}</ul>
    </div>`;
}

function renderConceptsSection() {
  if (!conceptsOpenAI) return '';
  const sections = lanes.map(lane => {
    const oai = conceptsOpenAI.results[lane.laneId];
    const gem = conceptsGemini?.results?.[lane.laneId];
    return `
    <div class="lane-concepts">
      <h3 class="lane-concept-head">
        <span class="pill ${laneClass(lane.laneId)}">${esc(lane.displayName)}</span>
        <span class="lane-audience-mini">${esc(lane.audience)}</span>
      </h3>
      <div class="concept-row">
        ${renderConcept(lane.laneId, oai, `OpenAI · ${conceptsOpenAI.model || 'gpt-4o-mini'}`)}
        ${gem ? renderConcept(lane.laneId, gem, `Gemini · ${conceptsGemini.model || 'gemini-pro'}`) : `
          <div class="concept-card concept-pending">
            <div class="concept-source">Gemini · pending</div>
            <h3 class="concept-name">Concept #2 awaiting Gemini key</h3>
            <p class="muted">Drop your Gemini API key (https://aistudio.google.com/app/apikey) into <code>~/.claude/secrets/gemini.key</code> and re-run the research script. The side-by-side will populate.</p>
          </div>
        `}
      </div>
    </div>`;
  }).join('');
  return `
  <section id="concepts" class="lab-section">
    <div class="section-head">
      <h2>🎨 Design Concepts</h2>
      <div class="section-sub">Side-by-side OpenAI vs Gemini — concept name, tagline, philosophy, full palette, typography, spacing, component preview, voice & tone, differentiators</div>
    </div>
    ${sections}
  </section>`;
}

// =====================================================================
// Section: SHOP PREVIEWS (from codex)
// =====================================================================
function renderShopPreviewsSection() {
  if (shopPreviews.length === 0) {
    return `
    <section id="shops" class="lab-section">
      <div class="section-head">
        <h2>🛍 Shop Previews</h2>
        <div class="section-sub">Codex-generated standalone HTML/CSS shop pages per brand lane — pending</div>
      </div>
      <div class="shop-pending">
        Codex frontend generation is running in the background. Once <code>mockups/shop-previews/*.html</code> appears, re-run the renderer.
      </div>
    </section>`;
  }
  const tiles = shopPreviews.map(f => `
    <div class="shop-tile">
      <div class="shop-tile-head">
        <h3>${esc(f.replace('.html',''))}</h3>
        <a href="shop-previews/${esc(f)}" target="_blank" class="open-link">Open in new tab →</a>
      </div>
      <iframe src="shop-previews/${esc(f)}" loading="lazy"></iframe>
    </div>
  `).join('');
  return `
  <section id="shops" class="lab-section">
    <div class="section-head">
      <h2>🛍 Shop Previews</h2>
      <div class="section-sub">Codex-generated standalone HTML/CSS shop pages — ${shopPreviews.length} live preview${shopPreviews.length === 1 ? '' : 's'}</div>
    </div>
    <div class="shop-grid">${tiles}</div>
  </section>`;
}

// =====================================================================
// Assemble HTML
// =====================================================================
const usageOAI = (trends?.usage?.prompt_tokens || 0) + (ugc?.usage?.prompt_tokens || 0) + (inspiration?.usage?.prompt_tokens || 0) + (conceptsOpenAI?.usage?.prompt_tokens || 0);
const usageOAIOut = (trends?.usage?.completion_tokens || 0) + (ugc?.usage?.completion_tokens || 0) + (inspiration?.usage?.completion_tokens || 0) + (conceptsOpenAI?.usage?.completion_tokens || 0);
const costOAI = (usageOAI / 1_000_000) * 0.15 + (usageOAIOut / 1_000_000) * 0.60;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MJB Design Lab — Research, UGC, Inspiration, Concepts</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0e1a;--bg-card:#131829;--bg-card-2:#1a2138;--border:#232a44;
  --text:#e8ecf5;--text-dim:#94a0c0;--text-faint:#5a6585;
  --accent:#6366f1;--success:#10b981;--warn:#f59e0b;--danger:#ef4444;
  --lane-home:#06b6d4;--lane-tech:#8b5cf6;--lane-utility:#f59e0b;
}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;padding:24px;min-height:100vh}
a{color:var(--accent);text-decoration:none}
code{background:rgba(0,0,0,.35);padding:1px 5px;border-radius:3px;font-family:"JetBrains Mono",monospace;font-size:11px;color:#a5b4fc}
.muted{color:var(--text-dim);font-size:12px;line-height:1.5}

.topbar{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--border)}
.topbar h1{font-size:22px;font-weight:800}
.topbar .sub{font-size:13px;color:var(--text-dim);margin-top:4px}
.top-stats{display:flex;gap:18px}
.top-stat{text-align:right}
.top-stat-num{font-size:18px;font-weight:800;color:var(--accent)}
.top-stat-lbl{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-top:2px}

nav.lab-nav{position:sticky;top:0;background:var(--bg);padding:12px 0;margin-bottom:24px;border-bottom:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap;z-index:10}
nav.lab-nav a{padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.04);font-size:12px;font-weight:600;color:var(--text-dim);border:1px solid var(--border)}
nav.lab-nav a:hover{background:rgba(99,102,241,.1);color:var(--accent);border-color:var(--accent)}

.lab-section{margin-bottom:48px}
.section-head{margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.section-head h2{font-size:22px;font-weight:800}
.section-sub{font-size:13px;color:var(--text-dim);margin-top:4px}

.pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(255,255,255,.05);color:var(--text-dim);border:1px solid var(--border)}
.lane-home{background:rgba(6,182,212,.15);color:var(--lane-home);border-color:rgba(6,182,212,.3)}
.lane-tech{background:rgba(139,92,246,.15);color:var(--lane-tech);border-color:rgba(139,92,246,.3)}
.lane-utility{background:rgba(245,158,11,.15);color:var(--lane-utility);border-color:rgba(245,158,11,.3)}
.tier-bullish,.tier-fast_growing,.tier-emerging,.tier-open,.tier-low{background:rgba(16,185,129,.15);color:var(--success);border-color:rgba(16,185,129,.3)}
.tier-stable,.tier-steady,.tier-medium{background:rgba(99,102,241,.15);color:var(--accent);border-color:rgba(99,102,241,.3)}
.tier-declining,.tier-saturated,.tier-extreme,.tier-high,.tier-mature{background:rgba(245,158,11,.15);color:var(--warn);border-color:rgba(245,158,11,.3)}
.bullets{list-style:none;padding-left:0;font-size:12px;line-height:1.55}
.bullets li{padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.04)}
.bullets li:last-child{border-bottom:0}
.bullets li:before{content:"▸ ";color:var(--accent);font-weight:700;margin-right:4px}
.bullets-good li:before{content:"✓ ";color:var(--success)}
.bullets-bad li:before{content:"✗ ";color:var(--danger)}

/* TRENDS */
.trend-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:18px}
.trend-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:20px}
.trend-card.error{color:var(--danger)}
.trend-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.trend-head h3{font-size:17px;font-weight:700}
.trend-chips{display:flex;flex-wrap:wrap;gap:5px}
.trend-key-metric{display:flex;align-items:baseline;gap:10px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:10px}
.kpi-num{font-size:24px;font-weight:800;color:var(--accent)}
.kpi-label{font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px}
.trend-quote{font-size:12px;color:var(--text-dim);font-style:italic;margin-bottom:14px}
.trend-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.trend-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-faint);margin-bottom:6px}
.trend-tag{display:inline-block;background:rgba(99,102,241,.12);color:var(--accent);padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600}
.conf{display:inline-block;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:5px;font-weight:700;text-transform:uppercase}
.conf-high{background:rgba(16,185,129,.2);color:var(--success)}
.conf-medium{background:rgba(245,158,11,.2);color:var(--warn)}
.conf-low{background:rgba(255,255,255,.06);color:var(--text-faint)}
.keyword-block{padding:12px;background:rgba(0,0,0,.2);border-radius:8px;margin-bottom:12px}
.kw-grid{display:grid;grid-template-columns:1fr;gap:8px}
.kw-group{display:flex;flex-direction:column;gap:4px}
.kw-label{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px}
.kw-tags{display:flex;flex-wrap:wrap;gap:4px}
.kw{padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600}
.kw-buy{background:rgba(16,185,129,.15);color:var(--success)}
.kw-research{background:rgba(99,102,241,.15);color:var(--accent)}
.kw-compare{background:rgba(245,158,11,.12);color:var(--warn)}
.comp-analysis{padding:12px;background:rgba(99,102,241,.04);border-radius:8px}

/* TABS */
.tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.tab{padding:8px 14px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);font-size:12px;font-weight:600;color:var(--text-dim);cursor:pointer;font-family:inherit;transition:all .15s}
.tab:hover{background:rgba(99,102,241,.1);color:var(--accent)}
.tab.active{background:var(--accent);color:white;border-color:var(--accent)}
.tab-panel{display:none}
.tab-panel.active{display:block}

/* UGC */
.ugc-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:1100px){.ugc-grid{grid-template-columns:1fr}}
.ugc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:18px}
.ugc-head{font-size:13px;font-weight:700;color:var(--accent);margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}
.ugc-meta{font-size:11px;color:var(--text-dim);margin-bottom:4px}
.ugc-row{font-size:12px;margin:8px 0;line-height:1.55}
.indent{padding-left:16px;color:var(--text-dim)}
.slot-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.slot{background:rgba(0,0,0,.25);border:1px solid var(--border);border-radius:6px;padding:8px;font-size:11px}
.slot-num{display:inline-block;background:var(--accent);color:white;width:18px;height:18px;border-radius:50%;text-align:center;line-height:18px;font-weight:700;font-size:10px;margin-right:6px}
.slot-label{display:inline-block;font-weight:700;color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.slot-purpose{color:var(--text);margin-bottom:4px;font-size:11px;font-weight:500}
.slot-row{font-size:10px;color:var(--text-dim);margin-top:3px;line-height:1.4}
.dodont-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
.dodont-head{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.dodont-head.good{color:var(--success)}
.dodont-head.bad{color:var(--danger)}

/* INSPIRATION */
.ins-grid{display:grid;grid-template-columns:1fr;gap:18px}
.ins-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:22px}
.ins-head{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.archetype{font-size:14px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:1px}
.ins-reasoning{font-size:13px;color:var(--text-dim);margin-bottom:16px;font-style:italic}
.ins-sub-head{font-size:11px;font-weight:700;color:var(--accent);margin:14px 0 6px;text-transform:uppercase;letter-spacing:1px}
.ref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-bottom:8px}
.ref-card{background:rgba(0,0,0,.25);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:11px}
.ref-name{font-weight:700;color:var(--text);font-size:12px}
.ref-vibe{color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin:3px 0}
.ref-why{color:var(--text-dim);font-size:11px;line-height:1.4}
.layout-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px}
.layout-grid > div{display:flex;flex-direction:column;background:rgba(0,0,0,.2);padding:8px;border-radius:6px;gap:3px}
.lk{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.lv{font-size:11px;color:var(--text);line-height:1.4}
.chip-row{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}

/* CONCEPTS */
.lane-concepts{margin-bottom:32px}
.lane-concept-head{display:flex;align-items:center;gap:10px;font-size:16px;margin-bottom:12px}
.lane-audience-mini{font-size:11px;color:var(--text-dim);font-weight:400}
.concept-row{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media (max-width:1200px){.concept-row{grid-template-columns:1fr}}
.concept-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:22px}
.concept-card.concept-pending{background:rgba(255,255,255,.02);border-style:dashed}
.concept-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px}
.concept-source{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-faint);margin-bottom:4px;font-weight:700}
.concept-name{font-size:24px;font-weight:900;color:var(--text);margin-bottom:2px}
.concept-tagline{font-size:14px;color:var(--accent);font-weight:600}
.concept-philosophy{font-size:12px;color:var(--text-dim);margin:10px 0 16px;line-height:1.6;font-style:italic}
.concept-section-label{font-size:11px;font-weight:700;color:var(--accent);margin:16px 0 8px;text-transform:uppercase;letter-spacing:1px}

.palette-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}
.swatch{padding:12px;border-radius:8px;text-align:center;font-size:10px}
.swatch-name{font-weight:700;font-size:11px;margin-bottom:2px}
.swatch-hex{font-family:"JetBrains Mono",monospace;font-size:10px;opacity:.85}
.swatch-usage{font-size:9px;opacity:.7;margin-top:4px;line-height:1.3}

.typo-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
@media (max-width:800px){.typo-row{grid-template-columns:1fr}}
.typo-card{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:12px;color:white}
.typo-label{font-size:9px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.typo-preview{font-size:32px;color:var(--text);line-height:1.1}
.typo-sample{font-size:12px;display:block;margin-top:6px;line-height:1.4}
.typo-meta{margin-top:8px;font-size:10px}

.spacing-row{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap}
.spacing-cell{display:flex;flex-direction:column;align-items:center;gap:4px}
.sp-box{background:var(--accent);border-radius:2px}
.sp-label{font-size:9px;color:var(--text-faint);font-family:"JetBrains Mono",monospace}

.component-preview{box-sizing:border-box}
.dodont-col{}

/* SHOPS */
.shop-grid{display:grid;grid-template-columns:1fr;gap:18px}
.shop-tile{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.shop-tile-head{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid var(--border)}
.shop-tile-head h3{font-size:14px;font-weight:700}
.open-link{font-size:11px;font-weight:600}
.shop-tile iframe{width:100%;height:540px;border:0;display:block;background:white}
.shop-pending{background:rgba(245,158,11,.05);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:16px;color:var(--warn);font-size:13px}

footer{margin-top:48px;padding-top:18px;border-top:1px solid var(--border);font-size:11px;color:var(--text-faint);text-align:center;line-height:1.7}
</style>
</head>
<body>

<div class="topbar">
  <div>
    <h1>MJB Design Lab</h1>
    <div class="sub">Deep research + UGC playbook + shop inspiration + design concepts · LLM-generated over real RapidAPI data</div>
  </div>
  <div class="top-stats">
    <div class="top-stat"><div class="top-stat-num">${nicheIds.length}</div><div class="top-stat-lbl">niches</div></div>
    <div class="top-stat"><div class="top-stat-num">${lanes.length}</div><div class="top-stat-lbl">brand lanes</div></div>
    <div class="top-stat"><div class="top-stat-num">${conceptsOpenAI ? lanes.length : 0}${conceptsGemini ? ` + ${lanes.length}` : ''}</div><div class="top-stat-lbl">design concepts</div></div>
    <div class="top-stat"><div class="top-stat-num">$${costOAI.toFixed(4)}</div><div class="top-stat-lbl">openai spend</div></div>
  </div>
</div>

<nav class="lab-nav">
  <a href="#trends">📈 Trends</a>
  <a href="#ugc">🎬 UGC</a>
  <a href="#inspiration">🏛 Inspiration</a>
  <a href="#concepts">🎨 Concepts</a>
  <a href="#shops">🛍 Shops</a>
</nav>

${renderTrendsSection()}
${renderUgcSection()}
${renderInspirationSection()}
${renderConceptsSection()}
${renderShopPreviewsSection()}

<footer>
  Generated from <code>mockups/real-trends/research/*.json</code> + <code>config/mjb/brand-lanes.json</code><br>
  OpenAI gpt-4o-mini: $${costOAI.toFixed(4)} · ${(usageOAI + usageOAIOut).toLocaleString()} tokens<br>
  Re-render anytime: <code>node packages/capabilities/product-intelligence/scripts/render-design-lab.mjs</code>
</footer>

<script>
// Tab switching
document.querySelectorAll('[data-tab-group]').forEach(group => {
  const groupName = group.dataset.tabGroup;
  const panels = document.querySelector('[data-tab-panels="' + groupName + '"]');
  group.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const targetPanel = tab.dataset.tab;
      panels.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.panel === targetPanel);
      });
    });
  });
});
</script>

</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html);
const sizeKb = (html.length / 1024).toFixed(1);
console.log(`wrote ${sizeKb}KB to ${OUT_HTML}`);
console.log(`niches: ${nicheIds.length}, lanes: ${lanes.length}, openai concepts: ${conceptsOpenAI ? lanes.length : 0}, gemini concepts: ${conceptsGemini ? lanes.length : 0}, shop previews: ${shopPreviews.length}`);
