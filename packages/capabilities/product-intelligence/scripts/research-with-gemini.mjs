#!/usr/bin/env node
/**
 * research-with-gemini.mjs — mirror of research-with-openai.mjs against
 * Google AI Studio's Gemini 2.5 Flash. Produces parallel research outputs
 * for true side-by-side comparison in the Design Lab.
 *
 * Outputs:
 *   trends-deep-dive-gemini.json
 *   ugc-best-practices-gemini.json
 *   shop-design-inspiration-gemini.json
 *   design-concepts-gemini.json
 *
 * Token source: env GEMINI_API_KEY, then %USERPROFILE%/.claude/secrets/gemini.key
 * Cost: gemini-2.5-flash $0.075/M input, $0.30/M output ≈ $0.005-0.01 total
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const OUT_DIR = path.join(DATA_DIR, 'research');
fs.mkdirSync(OUT_DIR, { recursive: true });

function loadKey() {
  const envK = (process.env.GEMINI_API_KEY || '').trim();
  if (envK.length > 30) return envK;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'gemini.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('GEMINI_API_KEY not found');
}

const KEY = loadKey();
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const candidates = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'candidates.json'), 'utf8'));
const lanesPath = path.join(REPO_ROOT, 'config', 'mjb', 'brand-lanes.json');
const brandLanes = JSON.parse(fs.readFileSync(lanesPath, 'utf8'));
const lanesById = Object.fromEntries(brandLanes.lanes.map(l => [l.laneId, l]));

const byNiche = {};
for (const c of candidates) (byNiche[c._nicheId] ||= []).push(c);

async function gemini(prompt, maxTokens = 2200) {
  const startedAt = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: maxTokens,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 0 }, // disable thinking for speed/cost
      },
    }),
  });
  const elapsedMs = Date.now() - startedAt;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    const finish = json.candidates?.[0]?.finishReason;
    throw new Error(`empty content; finishReason=${finish}; raw=${JSON.stringify(json).slice(0,200)}`);
  }
  const usage = json.usageMetadata;
  return {
    content,
    usage: {
      prompt_tokens: usage?.promptTokenCount || 0,
      completion_tokens: usage?.candidatesTokenCount || 0,
    },
    elapsedMs,
  };
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

async function trendsDeepDive() {
  console.log('[gemini] trends deep-dive');
  const results = {};
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  for (const [nicheId, cands] of Object.entries(byNiche)) {
    const lane = lanesById[cands[0]?._lane];
    const top10 = cands.slice(0, 10).map(condense);
    const prompt = `You are an ecommerce trend analyst. Based on these 10 real Amazon search results for the "${nicheId}" niche (brand lane: ${lane?.displayName || ''}, audience: ${lane?.audience || ''}), produce a deep trends analysis as strict JSON.

Real product data:
${JSON.stringify(top10, null, 2)}

Output JSON with this exact shape (no markdown, no commentary):
{
  "marketSentiment": "BULLISH" | "STABLE" | "DECLINING" | "EMERGING",
  "sentimentReasoning": "one sentence",
  "growthTrajectory": "FAST_GROWING" | "STEADY" | "MATURE" | "SATURATED",
  "estimatedSearchVolumeMonthly": <integer>,
  "topEmergingSubTrends": [ { "subTrend": "...", "evidenceFromData": "...", "confidence": "high|medium|low" }, ... 3-5 items ],
  "topKeywordsByIntent": { "buying": [5 items], "research": [5 items], "comparison": [3 items] },
  "competitionAnalysis": { "tier": "EXTREME|HIGH|MEDIUM|LOW|OPEN", "barrierToEntry": "...", "differentiatorsThatStillWork": [3 items] },
  "seasonality": "YEAR_ROUND|Q4_HEAVY|BACK_TO_SCHOOL|SPRING|SUMMER|HOLIDAY",
  "primaryAudienceSegment": "...",
  "audiencePainPoints": [5 items]
}`;
    try {
      const { content, usage, elapsedMs } = await gemini(prompt, 1800);
      results[nicheId] = JSON.parse(content);
      totalUsage.prompt_tokens += usage.prompt_tokens;
      totalUsage.completion_tokens += usage.completion_tokens;
      console.log(`  [OK] ${nicheId.padEnd(22)} ${elapsedMs}ms in=${usage.prompt_tokens} out=${usage.completion_tokens}`);
    } catch (e) {
      console.log(`  [FAIL] ${nicheId}: ${e.message.slice(0, 120)}`);
      results[nicheId] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'trends-deep-dive-gemini.json'), JSON.stringify({ model: MODEL, generatedAt: new Date().toISOString(), usage: totalUsage, results }, null, 2));
  return totalUsage;
}

async function ugcBestPractices() {
  console.log('[gemini] UGC best practices');
  const results = {};
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  for (const [nicheId, cands] of Object.entries(byNiche)) {
    const topNames = cands.slice(0, 5).map(c => c.name);
    const prompt = `You are a TikTok/short-form UGC strategist. For the "${nicheId}" niche, produce a strict-JSON best-practices guide.

Real top 5 product titles in this niche:
${JSON.stringify(topNames, null, 2)}

Output strict JSON (no markdown):
{
  "amazonListingImages": {
    "recommendedCount": <int 5-9>,
    "imageBreakdown": [ { "slot": "1 (hero)", "purpose": "...", "lightingNotes": "...", "compositionNotes": "..." }, ... 5-9 ],
    "mustHaveDimensions": "...",
    "backgroundConvention": "..."
  },
  "shortFormVideoUgc": {
    "idealLengthSec": <int>,
    "openingHookStyles": [strings],
    "lightingRecommendations": [strings],
    "audioStyle": "...",
    "captionStyle": "...",
    "hashtagCount": <int>
  },
  "productDescriptionPractices": {
    "titleCharRange": "...",
    "titleStructure": "...",
    "bulletPoints": { "count": <int>, "lengthPerBulletWords": "...", "leadWithBenefit": true, "followWithFeature": true },
    "aPlusContentRecommended": true,
    "keywordDensity": "...",
    "voiceAndTone": "..."
  },
  "differentiatorPlays": [5 items],
  "commonMistakes": [5 items]
}`;
    try {
      const { content, usage, elapsedMs } = await gemini(prompt, 2400);
      results[nicheId] = JSON.parse(content);
      totalUsage.prompt_tokens += usage.prompt_tokens;
      totalUsage.completion_tokens += usage.completion_tokens;
      console.log(`  [OK] ${nicheId.padEnd(22)} ${elapsedMs}ms in=${usage.prompt_tokens} out=${usage.completion_tokens}`);
    } catch (e) {
      console.log(`  [FAIL] ${nicheId}: ${e.message.slice(0, 120)}`);
      results[nicheId] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'ugc-best-practices-gemini.json'), JSON.stringify({ model: MODEL, generatedAt: new Date().toISOString(), usage: totalUsage, results }, null, 2));
  return totalUsage;
}

async function shopDesignInspiration() {
  console.log('[gemini] shop design inspiration');
  const results = {};
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  for (const lane of brandLanes.lanes) {
    const prompt = `You are an ecommerce frontend designer. For the brand lane "${lane.displayName}" with audience "${lane.audience}" and tone "${lane.tone}", produce strict-JSON shop design inspiration.

Output JSON (no markdown):
{
  "designArchetype": "BRUTALIST_MODERN|WARM_EDITORIAL|PLAYFUL_BOLD|QUIET_LUXURY|RETAIL_DENSE",
  "archetypeReasoning": "one sentence",
  "referenceSitesByVibe": [ { "siteName": "...", "vibe": "...", "whyRelevant": "..." }, ... 5-6 ],
  "layoutPatterns": { "homepageHeroPattern": "...", "productGridPattern": "...", "productDetailPattern": "...", "checkoutPattern": "..." },
  "trustElements": [strings],
  "ctaStyle": { "primaryButton": "...", "secondaryButton": "...", "microcopyVoice": "..." },
  "navigationPattern": "STICKY_MINIMAL|MEGA_MENU|BURGER_MOBILE_FIRST|BOTTOM_TAB_BAR",
  "imageryDirection": "...",
  "mobileFirstConsiderations": [3 items]
}`;
    try {
      const { content, usage, elapsedMs } = await gemini(prompt, 1800);
      results[lane.laneId] = JSON.parse(content);
      totalUsage.prompt_tokens += usage.prompt_tokens;
      totalUsage.completion_tokens += usage.completion_tokens;
      console.log(`  [OK] ${lane.laneId.padEnd(22)} ${elapsedMs}ms in=${usage.prompt_tokens} out=${usage.completion_tokens}`);
    } catch (e) {
      console.log(`  [FAIL] ${lane.laneId}: ${e.message.slice(0, 120)}`);
      results[lane.laneId] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'shop-design-inspiration-gemini.json'), JSON.stringify({ model: MODEL, generatedAt: new Date().toISOString(), usage: totalUsage, results }, null, 2));
  return totalUsage;
}

async function designConcepts() {
  console.log('[gemini] design concepts (concept #2)');
  const results = {};
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  for (const lane of brandLanes.lanes) {
    const prompt = `You are a brand designer producing CONCEPT #2 (a DIFFERENT direction from Concept #1) for ecommerce brand "${lane.displayName}" (audience: "${lane.audience}", tone: "${lane.tone}", sweet-spot: $${lane.priceBand?.sweetSpot}).

Concept #1 was conservative and broadly safe. Concept #2 should be DISTINCTIVE — take a more opinionated visual stance (warmer/cooler, bolder/quieter, more editorial/more retail) that still fits the audience. Output strict JSON:

{
  "conceptName": "2-3 word memorable name DIFFERENT from generic options",
  "conceptTagline": "one sentence brand promise",
  "designPhilosophy": "2-3 sentences explaining the distinctive stance",
  "colorPalette": {
    "primary":      { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "secondary":    { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "accent":       { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "neutralDark":  { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "neutralLight": { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "background":   { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "success":      { "hex": "#xxxxxx", "name": "...", "usage": "..." },
    "warning":      { "hex": "#xxxxxx", "name": "...", "usage": "..." }
  },
  "typography": {
    "displayFont":  { "name": "...", "fallbacks": "...", "weights": [400,700,900], "use": "..." },
    "bodyFont":     { "name": "...", "fallbacks": "...", "weights": [400,500,600], "use": "..." },
    "monoFont":     { "name": "JetBrains Mono", "fallbacks": "...", "weights": [400], "use": "..." },
    "scaleRatio": 1.25,
    "baselineSize": 16
  },
  "spacingTokens": { "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 40, "xxl": 64 },
  "componentStyle": {
    "buttonRadius": "...", "buttonShadow": "...", "cardRadius": "...", "cardShadow": "...", "imageRadius": "...", "inputStyle": "..."
  },
  "voiceAndTone": {
    "writingStyle": "...", "doSayList": [3 items], "dontSayList": [3 items], "exampleHeadline": "...", "exampleProductCopy": "..."
  },
  "differentiatingDetails": [3 items]
}`;
    try {
      const { content, usage, elapsedMs } = await gemini(prompt, 3000);
      results[lane.laneId] = JSON.parse(content);
      totalUsage.prompt_tokens += usage.prompt_tokens;
      totalUsage.completion_tokens += usage.completion_tokens;
      console.log(`  [OK] ${lane.laneId.padEnd(22)} ${elapsedMs}ms in=${usage.prompt_tokens} out=${usage.completion_tokens}`);
    } catch (e) {
      console.log(`  [FAIL] ${lane.laneId}: ${e.message.slice(0, 120)}`);
      results[lane.laneId] = { error: e.message };
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'design-concepts-gemini.json'), JSON.stringify({ model: MODEL, conceptNumber: 2, generatedAt: new Date().toISOString(), usage: totalUsage, results }, null, 2));
  return totalUsage;
}

console.log(`[gemini-research] model: ${MODEL}, key: ${KEY.slice(0,8)}... (${KEY.length} chars)`);
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
// gemini-2.5-flash pricing: $0.075/M input, $0.30/M output (text)
const costUsd = (grand.prompt_tokens / 1_000_000) * 0.075 + (grand.completion_tokens / 1_000_000) * 0.30;

console.log('');
console.log('=== Summary ===');
console.log(`Wallclock: ${(totalElapsed / 1000).toFixed(1)}s`);
console.log(`Prompt tokens: ${grand.prompt_tokens.toLocaleString()}`);
console.log(`Output tokens: ${grand.completion_tokens.toLocaleString()}`);
console.log(`Cost (est):    $${costUsd.toFixed(4)}`);
