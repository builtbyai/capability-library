#!/usr/bin/env node
/**
 * generate-shop-clusters.mjs — multi-category shop pipeline.
 *
 * Supersedes generate-shop-logos.mjs's per-niche approach. Per user
 * feedback (2026-06-30): single-niche shops feel too thin to be
 * believable e-commerce brands. Each shop here covers a CLUSTER of
 * related niches under one unified brand identity.
 *
 * Clusters:
 *   home    — drawer + closet + bathroom organizers + lint roller + spice rack
 *   tech    — magnetic charger + cable organizer + phone mount
 *   utility — silicone utensil + travel bottle (and future general utility)
 *
 * Step 1 (OpenAI gpt-4o-mini): one shop concept per cluster, given
 * the top 3 products across ALL niches in the cluster.
 *
 * Step 2 (Replicate flux-1.1-pro-ultra): one logo per cluster.
 *
 * Outputs:
 *   mockups/real-trends/generated/shop-clusters/<cluster>.json
 *   mockups/real-trends/generated/shop-clusters/<cluster>-mark.png
 *   mockups/real-trends/generated/shop-clusters/index.json
 *   → all auto-uploaded to R2 under mjb/shops/clusters/
 *
 * Cost: 3 clusters × (~$0.0015 LLM + $0.06 Replicate) = ~$0.19 total
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const OUT_DIR = path.join(DATA_DIR, 'generated', 'shop-clusters');
const REGISTRY = path.join(OUT_DIR, 'index.json');
fs.mkdirSync(OUT_DIR, { recursive: true });

function loadGeminiKey() {
  const env = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (env) return env;
  const p = path.join(os.homedir(), '.claude', 'secrets', 'gemini.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('GEMINI_API_KEY not set and ~/.claude/secrets/gemini.key not found');
}
const GEMINI_KEY = loadGeminiKey();
const REPLICATE_TOKEN = (process.env.REPLICATE_API_TOKEN || fs.readFileSync(path.join(os.homedir(), '.claude', 'secrets', 'replicate.token'), 'utf8')).trim();
if (!REPLICATE_TOKEN.startsWith('r8_')) { console.error('REPLICATE_API_TOKEN missing'); process.exit(1); }

const REPLICATE_MODEL = 'black-forest-labs/flux-1.1-pro-ultra';

const CLUSTERS = {
  home: {
    label: 'Home Organization',
    lane: 'mjb-home-finds',
    niches: ['drawer-organizer', 'closet-organizer', 'bathroom-organizer', 'lint-roller', 'spice-rack'],
    tone: 'warm, lived-in, calming. The customer wants the visual peace of an organized home, not industrial efficiency.',
  },
  tech: {
    label: 'Tech Accessories',
    lane: 'mjb-tech-finds',
    niches: ['magnetic-charger', 'cable-organizer', 'phone-mount'],
    tone: 'sleek, modern, gadgety-but-not-cold. Buyer values precise function and the small dopamine hit of a beautifully snapping magnetic mount.',
  },
  utility: {
    label: 'Everyday Utility',
    lane: 'mjb-everyday-utility',
    niches: ['silicone-utensil', 'travel-bottle'],
    tone: 'practical, optimistic, slightly playful. These are the small things that make daily life easier and feel like a tiny upgrade.',
  },
};

const candidates = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'candidates.json'), 'utf8'));
const byNiche = {};
for (const c of candidates) (byNiche[c._nicheId] ||= []).push(c);

const candidateScore = (c) =>
  (c.competitiveContext?.isBestSeller ? 1000 : 0) +
  (c.competitiveContext?.isAmazonChoice ? 500 : 0) +
  (c.reviewSummary?.avgRating ?? 0) * 50 +
  Math.min(c.reviewSummary?.count ?? 0, 100000) * 0.001;

function pickRepresentatives(clusterNiches) {
  const reps = [];
  for (const n of clusterNiches) {
    const inNiche = byNiche[n] || [];
    if (!inNiche.length) continue;
    const top = [...inNiche].sort((a,b) => candidateScore(b) - candidateScore(a))[0];
    reps.push({ niche: n, name: top.name?.slice(0, 80), price: top.priceUsd, rating: top.reviewSummary?.avgRating });
  }
  return reps;
}

// ===== Step 1: LLM concept per cluster =====
async function genClusterConcept(clusterKey, cluster) {
  const reps = pickRepresentatives(cluster.niches);
  const prompt = `You are a brand designer. Design ONE cohesive ECOMMERCE SHOP that sells the following ${cluster.niches.length} product categories under ONE unified brand. This is NOT a single-product store — it spans multiple related categories sharing a customer-type and aesthetic.

CLUSTER: ${cluster.label}
Tone: ${cluster.tone}

Categories the shop covers: ${cluster.niches.join(', ')}

Top-rated representative products in this cluster:
${JSON.stringify(reps, null, 2)}

Output strict JSON, no preamble:
{
  "shopName": "1-3 word memorable, NOT generic. Avoid 'Pro/Hub/Co' clichés unless they truly fit. Examples of GOOD: 'Tidy', 'Quartz', 'Mott', 'Wove', 'Granular', 'Linden'. Examples of BAD: 'HomeOrgPro', 'TechAccessoryHub'. Must feel like a real DTC brand a customer would discover on TikTok.",
  "shopTagline": "one short sentence that promises an outcome the customer wants across ALL covered categories — not just one",
  "brandArchetype": "WARM_MINIMAL" | "PLAYFUL_BOLD" | "PRECISION_TECH" | "ARTISAN_CRAFT" | "EDITORIAL_QUIET" | "RETAIL_DENSE",
  "archetypeReasoning": "one sentence why this archetype fits buyers across ALL of these categories",
  "colorPaletteHints": ["#xxxxxx", "#xxxxxx", "#xxxxxx"],
  "paletteRationale": "one sentence",
  "typographyHint": "geometric sans-serif / editorial serif / humanist mono / etc",
  "voiceTone": "3-5 adjectives, comma-separated",
  "categoryPositioning": "one sentence describing how this single shop frames ${cluster.niches.length} different product lines as one coherent buying journey (NOT 'we sell drawer organizers AND chargers')",
  "logoMarkPrompt": "Full Replicate flux-1.1-pro-ultra prompt for a logo image. Be specific about style, layout (horizontal/stacked/icon-only), colors (use hex from palette), letter treatment. Aim for a flat-vector look on a clean background, no photographic textures, no people. Output a logo that would work on a brand TikTok, an Amazon storefront, and a sticker on a product box.",
  "logoOrientation": "horizontal" | "stacked" | "icon-only"
}`;

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt + '\n\nReturn ONLY the JSON object, no markdown fence, no preamble.' }] }],
      generationConfig: { temperature: 0.85, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const concept = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
  concept._meta = { clusterKey, niches: cluster.niches, lane: cluster.lane, generatedAt: new Date().toISOString(), model: 'gemini-2.5-flash', usage: data.usageMetadata };
  return concept;
}

// ===== Step 2: Replicate logo gen =====
async function genClusterLogo(clusterKey, concept) {
  const submit = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REPLICATE_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({
      input: {
        prompt: concept.logoMarkPrompt,
        aspect_ratio: concept.logoOrientation === 'horizontal' ? '16:9' : '1:1',
        output_format: 'png',
        safety_tolerance: 2,
        raw: false,
      },
    }),
  });
  if (!submit.ok) throw new Error(`Replicate ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  let pred = await submit.json();
  while (pred.status === 'starting' || pred.status === 'processing') {
    await new Promise(r => setTimeout(r, 2500));
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` } })).json();
  }
  if (pred.status !== 'succeeded') throw new Error(`pred ${pred.status}: ${JSON.stringify(pred.error).slice(0,200)}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const filename = `${clusterKey}-mark.png`;
  const filepath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filepath, buf);
  const r2 = await tryPutR2(`mjb/shops/clusters/${filename}`, filepath, { contentType: 'image/png' });
  return { filepath, bytes: buf.length, predictionId: pred.id, r2: r2.ok ? r2 : null };
}

// ===== Run =====
const results = {};
let totalCost = 0;
for (const [key, cluster] of Object.entries(CLUSTERS)) {
  console.log('');
  console.log(`=== ${key} (${cluster.label}) — ${cluster.niches.length} niches ===`);
  try {
    const concept = await genClusterConcept(key, cluster);
    console.log(`  concept: ${concept.shopName} · ${concept.shopTagline}`);
    fs.writeFileSync(path.join(OUT_DIR, `${key}.json`), JSON.stringify(concept, null, 2));
    await tryPutR2(`mjb/shops/clusters/${key}.json`, path.join(OUT_DIR, `${key}.json`), { contentType: 'application/json' });
    totalCost += 0.0015;

    const logo = await genClusterLogo(key, concept);
    console.log(`  logo: ${(logo.bytes/1024).toFixed(0)}KB → ${logo.r2?.publicUrl || '(r2 fail)'}`);
    totalCost += 0.06;

    results[key] = {
      clusterKey: key,
      label: cluster.label,
      lane: cluster.lane,
      niches: cluster.niches,
      shopName: concept.shopName,
      shopTagline: concept.shopTagline,
      brandArchetype: concept.brandArchetype,
      file: path.relative(REPO_ROOT, logo.filepath).replace(/\\/g, '/'),
      r2Key: logo.r2?.key || null,
      r2Url: logo.r2?.publicUrl || null,
      predictionId: logo.predictionId,
      generatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`  FAIL: ${e.message}`);
    results[key] = { clusterKey: key, error: e.message };
  }
  await new Promise(r => setTimeout(r, 4000));
}

fs.writeFileSync(REGISTRY, JSON.stringify(results, null, 2));

console.log('');
console.log('=== Summary ===');
console.log(`Clusters generated: ${Object.values(results).filter(r => !r.error).length}/${Object.keys(CLUSTERS).length}`);
console.log(`Total cost (est): $${totalCost.toFixed(2)}`);
console.log(`Registry: ${REGISTRY}`);
