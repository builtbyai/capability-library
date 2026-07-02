#!/usr/bin/env node
/**
 * research-with-openai.mjs — uses GPT-4o to deep-research the trends data
 * we pulled from RapidAPI. Produces structured research output for the
 * MJB Design Lab view:
 *
 *   - Trends deep-dive per niche (sentiment, growth, sub-trends, keywords)
 *   - UGC best practices per niche (image count, lighting, descriptions)
 *   - Shop design inspiration patterns per brand lane
 *   - 2 brand design concepts per lane (palette + typography + voice)
 *
 * Token budget: ~5000 input × 10 niches + 3000 input × 3 lanes for design
 *   = ~60K input + ~30K output = ~$0.50 at gpt-4o-mini pricing
 * Model: gpt-4o-mini (cheap + plenty good for research synthesis)
 *
 * Outputs to: mockups/real-trends/research/
 *   ugc-best-practices.json
 *   trends-deep-dive.json
 *   shop-design-inspiration.json
 *   design-concepts-openai.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const OUT_DIR = path.join(DATA_DIR, 'research');
fs.mkdirSync(OUT_DIR, { recursive: true });

const KEY = process.env.OPENAI_API_KEY?.trim();
if (!KEY || !KEY.startsWith('sk-')) {
  console.error('OPENAI_API_KEY not set in env');
  process.exit(1);
}

const MODEL = 'gpt-4o-mini';

const candidates = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'candidates.json'), 'utf8'));
const lanesPath = path.join(REPO_ROOT, 'config', 'mjb', 'brand-lanes.json');
const brandLanes = JSON.parse(fs.readFileSync(lanesPath, 'utf8'));
const lanesById = Object.fromEntries(brandLanes.lanes.map(l => [l.laneId, l]));

const byNiche = {};
for (const c of candidates) (byNiche[c._nicheId] ||= []).push(c);

async function openai(payload) {
  const startedAt = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      ...payload,
    }),
  });
  const elapsedMs = Date.now() - startedAt;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  const usage = json.usage;
  return { content, usage, elapsedMs };
}

function condense(c) {
  return {
    name: c.name,
    price: c.priceUsd,
    rating: c.reviewSummary?.avgRating,
    reviewCount: c.reviewSummary?.count,
    bestSeller: !!c.competitiveContext?.isBestSeller,
    amazonChoice: !!c.competitiveContext?.isAmazonChoice,
    salesVolume: c.competitiveContext?.salesVolume,
  };
}

// ===== 1. Trends deep-dive per niche =====
async function trendsDeepDive() {
  console.log('[research] trends deep-dive — 10 niches');
  const results = {};
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  for (const [nicheId, cands] of Object.entries(byNiche)) {
    const lane = lanesById[cands[0]?._lane];
    const top10 = cands.slice(0, 10).map(condense);
    const prompt = `You are an ecommerce trend analyst. Based on these 10 real Amazon search results for the "${nicheId}" niche (brand lane: ${lane?.displayName || ''}, audience: ${lane?.audience || ''}), produce a deep trends analysis as strict JSON.

Real product data:
${JSON.stringify(top10, null, 2)}

Output JSON with this exact shape:
{
  "marketSentiment": "BULLISH" | "STABLE" | "DECLINING" | "EMERGING",
  "sentimentReasoning": "one sentence",
  "growthTrajectory": "FAST_GROWING" | "STEADY" | "MATURE" | "SATURATED",
  "estimatedSearchVolumeMonthly": <integer, your best estimate>,
  "topEmergingSubTrends": [
    { "subTrend": "...", "evidenceFromData": "...", "confidence": "high|medium|low" },
    ... 3-5 items
  ],
  "topKeywordsByIntent": {
    "buying": ["...", "...", "...", "...", "..."],
    "research": ["...", "...", "...", "...", "..."],
    "comparison": ["...", "...", "..."]
  },
  "competitionAnalysis": {
    "tier": "EXTREME" | "HIGH" | "MEDIUM" | "LOW" | "OPEN",
    "barrierToEntry": "...",
    "differentiatorsThatStillWork": ["...", "...", "..."]
  },
  "seasonality": "YEAR_ROUND" | "Q4_HEAVY" | "BACK_TO_SCHOOL" | "SPRING" | "SUMMER" | "HOLIDAY",
  "primaryAudienceSegment": "description of who actually buys this",
  "audiencePainPoints": ["...", "...", "...", "...", "..."]
}`;
    try {
      const { content, usage, elapsedMs } = await openai({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });
      results[nicheId] = JSON.parse(content);
      totalUsage.prompt_tokens += usage?.prompt_tokens || 0;
      totalUsage.completion_tokens += usage?.completion_tokens || 0;
      console.log(`  [OK] ${nicheId.padEnd(22)} ${elapsedMs}ms in=${usage?.prompt_tokens} out=${usage?.completion_tokens}`);
    } catch (e) {
      console.log(`  [FAIL] ${nicheId}: ${e.message}`);
      results[nicheId] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'trends-deep-dive.json'), JSON.stringify({ model: MODEL, generatedAt: new Date().toISOString(), usage: totalUsage, results }, null, 2));
  return totalUsage;
}

// ===== 2. UGC best practices per niche =====
async function ugcBestPractices() {
  console.log('[research] UGC best practices — 10 niches');
  const results = {};
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  for (const [nicheId, cands] of Object.entries(byNiche)) {
    const topNames = cands.slice(0, 5).map(c => c.name);
    const prompt = `You are a TikTok/short-form UGC strategist. For the "${nicheId}" niche on platforms like TikTok / Instagram Reels / Pinterest, produce a strict-JSON best-practices guide.

Real top 5 product titles in this niche:
${JSON.stringify(topNames, null, 2)}

Output JSON with this exact shape:
{
  "amazonListingImages": {
    "recommendedCount": <integer 5-9>,
    "imageBreakdown": [
      { "slot": "1 (hero)", "purpose": "...", "lightingNotes": "...", "compositionNotes": "..." },
      { "slot": "2 (in-use lifestyle)", ... },
      ... 5-9 entries total
    ],
    "mustHaveDimensions": "...",
    "backgroundConvention": "..."
  },
  "shortFormVideoUgc": {
    "idealLengthSec": <integer>,
    "openingHookStyles": ["problem-reveal", "discovery", ...],
    "lightingRecommendations": ["natural daylight near a window facing east", ...],
    "audioStyle": "...",
    "captionStyle": "...",
    "hashtagCount": <integer>
  },
  "productDescriptionPractices": {
    "titleCharRange": "150-200",
    "titleStructure": "[Brand] [Material] [Type] [Use Case] [Pack Count] [Color/Size]",
    "bulletPoints": {
      "count": <integer>,
      "lengthPerBulletWords": "...",
      "leadWithBenefit": true,
      "followWithFeature": true
    },
    "aPlusContentRecommended": true,
    "keywordDensity": "...",
    "voiceAndTone": "..."
  },
  "differentiatorPlays": ["...", "...", "...", "...", "..."],
  "commonMistakes": ["...", "...", "...", "...", "..."]
}`;
    try {
      const { content, usage, elapsedMs } = await openai({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });
      results[nicheId] = JSON.parse(content);
      totalUsage.prompt_tokens += usage?.prompt_tokens || 0;
      totalUsage.completion_tokens += usage?.completion_tokens || 0;
      console.log(`  [OK] ${nicheId.padEnd(22)} ${elapsedMs}ms in=${usage?.prompt_tokens} out=${usage?.completion_tokens}`);
    } catch (e) {
      console.log(`  [FAIL] ${nicheId}: ${e.message}`);
      results[nicheId] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'ugc-best-practices.json'), JSON.stringify({ model: MODEL, generatedAt: new Date().toISOString(), usage: totalUsage, results }, null, 2));
  return totalUsage;
}

// ===== 3. Shop design inspiration per brand lane =====
async function shopDesignInspiration() {
  console.log('[research] shop design inspiration — 3 brand lanes');
  const results = {};
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  for (const lane of brandLanes.lanes) {
    const prompt = `You are an ecommerce frontend designer. For the brand lane "${lane.displayName}" with audience "${lane.audience}" and tone "${lane.tone}", produce strict-JSON shop design inspiration.

Output JSON with this exact shape:
{
  "designArchetype": "BRUTALIST_MODERN" | "WARM_EDITORIAL" | "PLAYFUL_BOLD" | "QUIET_LUXURY" | "RETAIL_DENSE",
  "archetypeReasoning": "one sentence why this fits the audience+tone",
  "referenceSitesByVibe": [
    { "siteName": "Allbirds", "vibe": "...", "whyRelevant": "..." },
    { "siteName": "...", "vibe": "...", "whyRelevant": "..." },
    ... 5-6 entries
  ],
  "layoutPatterns": {
    "homepageHeroPattern": "...",
    "productGridPattern": "...",
    "productDetailPattern": "...",
    "checkoutPattern": "..."
  },
  "trustElements": ["UGC reviews band", "shipping promise pill", ...],
  "ctaStyle": {
    "primaryButton": "...",
    "secondaryButton": "...",
    "microcopyVoice": "..."
  },
  "navigationPattern": "STICKY_MINIMAL" | "MEGA_MENU" | "BURGER_MOBILE_FIRST" | "BOTTOM_TAB_BAR",
  "imageryDirection": "...",
  "mobileFirstConsiderations": ["...", "...", "..."]
}`;
    try {
      const { content, usage, elapsedMs } = await openai({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });
      results[lane.laneId] = JSON.parse(content);
      totalUsage.prompt_tokens += usage?.prompt_tokens || 0;
      totalUsage.completion_tokens += usage?.completion_tokens || 0;
      console.log(`  [OK] ${lane.laneId.padEnd(22)} ${elapsedMs}ms in=${usage?.prompt_tokens} out=${usage?.completion_tokens}`);
    } catch (e) {
      console.log(`  [FAIL] ${lane.laneId}: ${e.message}`);
      results[lane.laneId] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'shop-design-inspiration.json'), JSON.stringify({ model: MODEL, generatedAt: new Date().toISOString(), usage: totalUsage, results }, null, 2));
  return totalUsage;
}

// ===== 4. Design concepts (palette + typography + voice) per lane =====
async function designConcepts() {
  console.log('[research] design concepts (concept #1) — 3 brand lanes');
  const results = {};
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  for (const lane of brandLanes.lanes) {
    const prompt = `You are a brand designer. Generate a complete design system for ecommerce brand "${lane.displayName}" (audience: "${lane.audience}", tone: "${lane.tone}", sweet-spot price: $${lane.priceBand?.sweetSpot}). This is CONCEPT #1 (a distinctive original direction). Output strict JSON.

{
  "conceptName": "a 2-3 word memorable name like 'Quiet Pantry' or 'Tactile Modern'",
  "conceptTagline": "one sentence that crystallizes the brand promise",
  "designPhilosophy": "2-3 sentences",
  "colorPalette": {
    "primary":   { "hex": "#xxxxxx", "name": "...", "usage": "primary CTA + accent" },
    "secondary": { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "accent":    { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "neutralDark":  { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "neutralLight": { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "background":   { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "success":      { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "warning":      { "hex": "#xxxxxx", "name": "...", "usage": "..." }
  },
  "typography": {
    "displayFont":  { "name": "Inter Display", "fallbacks": "...", "weights": [400, 700, 900], "use": "..." },
    "bodyFont":     { "name": "Inter", "fallbacks": "...", "weights": [400, 500, 600], "use": "..." },
    "monoFont":     { "name": "JetBrains Mono", "fallbacks": "...", "weights": [400], "use": "..." },
    "scaleRatio": 1.25,
    "baselineSize": 16
  },
  "spacingTokens": { "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 40, "xxl": 64 },
  "componentStyle": {
    "buttonRadius": "6px",
    "buttonShadow": "0 1px 2px rgba(0,0,0,.08)",
    "cardRadius": "12px",
    "cardShadow": "0 4px 16px rgba(0,0,0,.06)",
    "imageRadius": "8px",
    "inputStyle": "..."
  },
  "voiceAndTone": {
    "writingStyle": "...",
    "doSayList": ["...", "...", "..."],
    "dontSayList": ["...", "...", "..."],
    "exampleHeadline": "...",
    "exampleProductCopy": "..."
  },
  "differentiatingDetails": ["one detail that competitors don't do", "...", "..."]
}`;
    try {
      const { content, usage, elapsedMs } = await openai({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      results[lane.laneId] = JSON.parse(content);
      totalUsage.prompt_tokens += usage?.prompt_tokens || 0;
      totalUsage.completion_tokens += usage?.completion_tokens || 0;
      console.log(`  [OK] ${lane.laneId.padEnd(22)} ${elapsedMs}ms in=${usage?.prompt_tokens} out=${usage?.completion_tokens}`);
    } catch (e) {
      console.log(`  [FAIL] ${lane.laneId}: ${e.message}`);
      results[lane.laneId] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'design-concepts-openai.json'), JSON.stringify({ model: MODEL, conceptNumber: 1, generatedAt: new Date().toISOString(), usage: totalUsage, results }, null, 2));
  return totalUsage;
}

// ===== Run all in parallel =====
console.log(`[openai-research] model: ${MODEL}, key: ${KEY.slice(0,7)}... (${KEY.length} chars)`);
console.log(`[openai-research] niches: ${Object.keys(byNiche).length}, lanes: ${brandLanes.lanes.length}, candidates: ${candidates.length}`);
console.log('');

const startedAt = Date.now();
const [u1, u2, u3, u4] = await Promise.all([
  trendsDeepDive(),
  ugcBestPractices(),
  shopDesignInspiration(),
  designConcepts(),
]);
const totalElapsed = Date.now() - startedAt;

const grand = {
  prompt_tokens: u1.prompt_tokens + u2.prompt_tokens + u3.prompt_tokens + u4.prompt_tokens,
  completion_tokens: u1.completion_tokens + u2.completion_tokens + u3.completion_tokens + u4.completion_tokens,
};
// gpt-4o-mini pricing: $0.15/M input, $0.60/M output
const costUsd = (grand.prompt_tokens / 1_000_000) * 0.15 + (grand.completion_tokens / 1_000_000) * 0.60;

console.log('');
console.log('=== Summary ===');
console.log(`Total wallclock: ${(totalElapsed / 1000).toFixed(1)}s`);
console.log(`Prompt tokens:   ${grand.prompt_tokens.toLocaleString()}`);
console.log(`Output tokens:   ${grand.completion_tokens.toLocaleString()}`);
console.log(`Cost estimated:  $${costUsd.toFixed(4)}`);
console.log(`Output dir:      ${OUT_DIR}`);
