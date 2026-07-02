#!/usr/bin/env node
/**
 * generate-shop-logos.mjs — two-step dynamic shop-logo pipeline.
 *
 * Step 1 (OpenAI gpt-4o-mini): for each trending niche, generate a fictional
 * shop concept (name, tagline, archetype, palette hints, typography, full
 * Replicate prompt) that would sell THAT product category most effectively.
 *
 * Step 2 (Replicate flux-1.1-pro-ultra): use the LLM-generated logoMarkPrompt
 * to produce one logo image per niche. Sequential w/ 8s spacing + 429
 * backoff to stay under Replicate's per-minute rate limit.
 *
 * Outputs:
 *   mockups/real-trends/generated/shop-concepts/<niche>.json
 *   mockups/real-trends/generated/shop-logos/<niche>-mark.png
 *   mockups/real-trends/generated/shop-logos/index.json
 *
 * Cost: 10 niches × (~$0.001 LLM + $0.06 Replicate) = ~$0.61 total
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const CONCEPTS_DIR = path.join(DATA_DIR, 'generated', 'shop-concepts');
const LOGOS_DIR = path.join(DATA_DIR, 'generated', 'shop-logos');
const REGISTRY = path.join(LOGOS_DIR, 'index.json');

fs.mkdirSync(CONCEPTS_DIR, { recursive: true });
fs.mkdirSync(LOGOS_DIR, { recursive: true });

const OPENAI_KEY = (process.env.OPENAI_API_KEY || '').trim();
const REPLICATE_TOKEN = (process.env.REPLICATE_API_TOKEN || fs.readFileSync(path.join(os.homedir(), '.claude', 'secrets', 'replicate.token'), 'utf8')).trim();
if (!OPENAI_KEY.startsWith('sk-')) { console.error('OPENAI_API_KEY missing'); process.exit(1); }
if (!REPLICATE_TOKEN.startsWith('r8_')) { console.error('REPLICATE_API_TOKEN missing'); process.exit(1); }

const REPLICATE_MODEL = 'black-forest-labs/flux-1.1-pro-ultra';

const candidates = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'candidates.json'), 'utf8'));
const summary = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'summary.json'), 'utf8'));
const byNiche = {};
for (const c of candidates) (byNiche[c._nicheId] ||= []).push(c);

// ===== Step 1: LLM concept per niche =====
async function genShopConcept(nicheId, top5) {
  const condensed = top5.map(c => ({ name: c.name, price: c.priceUsd, rating: c.reviewSummary?.avgRating }));
  const prompt = `You are a brand designer. For a fictional ECOMMERCE SHOP that would sell this product category most effectively, design the shop identity. The shop is independent — NOT MJB-branded. Pick a name + vibe that customers searching for "${nicheId}" would trust and remember.

Real top 5 products customers find when searching this category:
${JSON.stringify(condensed, null, 2)}

Output strict JSON:
{
  "shopName": "1-3 word memorable, NOT generic. Avoid 'Pro/Hub/Co' clichés unless they truly fit. Examples of GOOD: 'Tidy', 'Quartz', 'Mott', 'Wove', 'Granular'. Examples of BAD: 'OrganizerPro', 'TheCableHub'.",
  "shopTagline": "one short sentence that crystallizes the promise",
  "brandArchetype": "WARM_MINIMAL" | "PLAYFUL_BOLD" | "PRECISION_TECH" | "ARTISAN_CRAFT" | "EDITORIAL_QUIET" | "RETAIL_DENSE",
  "archetypeReasoning": "one sentence why this archetype fits THIS product's typical buyer",
  "colorPaletteHints": ["#xxxxxx", "#xxxxxx", "#xxxxxx"],
  "paletteRationale": "one sentence",
  "typographyHint": "specific style: e.g. 'geometric grotesque, condensed' or 'editorial serif with high contrast'",
  "voiceTone": "3-5 word adjective phrase",
  "logoMarkPrompt": "A complete Replicate flux prompt for the logo. Be very specific: composition, lighting, material, exact color references using the paletteHints, mood. The prompt should produce a single beautiful logo image (the brand mark + name together, OR just a distinctive mark — your choice based on the archetype). Photographed on neutral background. NO other text or graphics besides the logo. Aspect ratio guidance assumed 3:2 horizontal.",
  "logoOrientation": "horizontal" | "vertical" | "square"
}

This shop must feel ORIGINAL — distinct from the other 9 niche shops in this batch. Make a memorable identity, not a generic placeholder.`;
  const startedAt = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8, // higher = more variety across the 10 shops
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const concept = JSON.parse(j.choices[0].message.content);
  concept._meta = { nicheId, generatedAt: new Date().toISOString(), model: 'gpt-4o-mini', usage: j.usage, elapsedMs: Date.now() - startedAt };
  const conceptPath = path.join(CONCEPTS_DIR, `${nicheId}.json`);
  fs.writeFileSync(conceptPath, JSON.stringify(concept, null, 2));
  // Auto-publish concept JSON to R2
  await tryPutR2(`mjb/shops/concepts/${nicheId}.json`, conceptPath);
  return concept;
}

// ===== Step 2: Replicate logo from concept =====
async function genLogo(nicheId, concept, attempt = 1) {
  const startedAt = Date.now();
  const aspect = concept.logoOrientation === 'vertical' ? '2:3' : concept.logoOrientation === 'square' ? '1:1' : '3:2';
  const submit = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REPLICATE_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({
      input: {
        prompt: concept.logoMarkPrompt,
        aspect_ratio: aspect,
        output_format: 'png',
        safety_tolerance: 2,
        raw: false,
      },
    }),
  });
  if (submit.status === 429 && attempt < 6) {
    const wait = 15000 * attempt;
    console.log(`  [429] ${nicheId} backoff ${wait}ms (${attempt + 1}/6)`);
    await new Promise(r => setTimeout(r, wait));
    return genLogo(nicheId, concept, attempt + 1);
  }
  if (!submit.ok) throw new Error(`submit ${submit.status} ${(await submit.text()).slice(0, 200)}`);
  let pred = await submit.json();
  while (pred.status === 'starting' || pred.status === 'processing') {
    await new Promise(r => setTimeout(r, 2500));
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` } })).json();
  }
  if (pred.status !== 'succeeded') throw new Error(`pred ${pred.status}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const file = `${nicheId}-mark.png`;
  const filepath = path.join(LOGOS_DIR, file);
  fs.writeFileSync(filepath, buf);
  // Auto-publish logo PNG to R2
  const upload = await tryPutR2(`mjb/shops/${file}`, filepath);
  return { nicheId, file, bytes: buf.length, elapsedMs: Date.now() - startedAt, predictionId: pred.id, r2Url: upload.ok ? upload.publicUrl : null };
}

// ===== Run sequentially per niche =====
const nicheIds = Object.keys(byNiche);
console.log(`[shop-logos] generating concepts + logos for ${nicheIds.length} niches`);
console.log('');

const concepts = {};
const logoResults = [];
const logoFails = [];

// Existing registry (resume)
const existingReg = fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) : {};

for (const nicheId of nicheIds) {
  const cands = byNiche[nicheId];
  // Step 1: concept (skip if exists)
  const conceptPath = path.join(CONCEPTS_DIR, `${nicheId}.json`);
  let concept;
  if (fs.existsSync(conceptPath) && !process.argv.includes('--regen-concepts')) {
    concept = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
    console.log(`  [concept reuse] ${nicheId.padEnd(22)} "${concept.shopName}" · ${concept.brandArchetype}`);
  } else {
    try {
      concept = await genShopConcept(nicheId, cands.slice(0, 5));
      console.log(`  [concept gen]   ${nicheId.padEnd(22)} "${concept.shopName}" · ${concept.brandArchetype} · ${concept._meta.elapsedMs}ms`);
    } catch (e) {
      console.log(`  [concept FAIL]  ${nicheId.padEnd(22)} ${e.message.slice(0, 100)}`);
      continue;
    }
  }
  concepts[nicheId] = concept;

  // Step 2: logo (skip if exists)
  const logoFile = `${nicheId}-mark.png`;
  const logoPath = path.join(LOGOS_DIR, logoFile);
  if (fs.existsSync(logoPath) && !process.argv.includes('--regen-logos')) {
    console.log(`  [logo reuse]    ${nicheId.padEnd(22)} ${logoFile} (${Math.round(fs.statSync(logoPath).size / 1024)}KB)`);
    existingReg[nicheId] = { nicheId, shopName: concept.shopName, archetype: concept.brandArchetype, file: `mockups/real-trends/generated/shop-logos/${logoFile}`, bytes: fs.statSync(logoPath).size, conceptFile: `mockups/real-trends/generated/shop-concepts/${nicheId}.json` };
    continue;
  }
  try {
    const r = await genLogo(nicheId, concept);
    logoResults.push(r);
    existingReg[nicheId] = { nicheId, shopName: concept.shopName, archetype: concept.brandArchetype, file: `mockups/real-trends/generated/shop-logos/${r.file}`, bytes: r.bytes, predictionId: r.predictionId, generatedAt: new Date().toISOString(), conceptFile: `mockups/real-trends/generated/shop-concepts/${nicheId}.json` };
    console.log(`  [logo OK]       ${nicheId.padEnd(22)} ${(r.bytes/1024).toFixed(0)}KB ${r.elapsedMs}ms · "${concept.shopName}"`);
  } catch (e) {
    logoFails.push({ nicheId, error: e.message });
    console.log(`  [logo FAIL]     ${nicheId.padEnd(22)} ${e.message.slice(0, 100)}`);
  }
  // 8s spacing between Replicate calls to stay under per-minute throttle
  await new Promise(r => setTimeout(r, 8000));
}

fs.writeFileSync(REGISTRY, JSON.stringify(existingReg, null, 2));

console.log('');
console.log('=== Summary ===');
console.log(`Concepts generated/reused: ${Object.keys(concepts).length}/${nicheIds.length}`);
console.log(`Logos generated:           ${logoResults.length}`);
console.log(`Logos failed:              ${logoFails.length}`);
console.log(`Total cost (est):          ~$${(logoResults.length * 0.06 + Object.keys(concepts).length * 0.001).toFixed(2)}`);
console.log(`Registry:                  ${REGISTRY}`);
