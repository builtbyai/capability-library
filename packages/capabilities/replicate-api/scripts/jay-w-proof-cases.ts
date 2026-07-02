#!/usr/bin/env tsx
/**
 * Fixed proof-case runner for comparing JAY_W LoRA model versions.
 *
 * Run from CODE_MODULE_LIBRARY with a TS runner, for example:
 *   REPLICATE_API_TOKEN=... npx tsx packages/capabilities/replicate-api/scripts/jay-w-proof-cases.ts
 *
 * Environment:
 *   PROOF_VERSIONS="builtbyai/jay_w:old,builtbyai/jay_w:new"
 *   PROOF_OUT="./output/proof_cases"
 *   DRY_RUN=1
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createReplicate } from '../backend/index.js';

type ProofCase = {
  id: string;
  brand: string;
  goal: string;
  prompt: string;
  aspect_ratio: string;
  seed: number;
};

type ProofResult = {
  case_id: string;
  version: string;
  status: string;
  prediction_id?: string;
  output_file?: string;
  web_url?: string;
  error?: unknown;
  metrics?: unknown;
};

const DEFAULT_VERSION =
  process.env.JAY_W_VERSION ??
  'builtbyai/jay_w:3fb30ff3edc568346cb8ce5186c6fd54a33e04c0763ce7ce986c4f6b764e8f39';

const versions = (process.env.PROOF_VERSIONS ?? process.env.PROOF_VERSION ?? DEFAULT_VERSION)
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const outRoot =
  process.env.PROOF_OUT ??
  './output/proof_cases';

const dryRun = process.env.DRY_RUN === '1';
const proofLimit = Number(process.env.PROOF_LIMIT ?? '999');
const budgetUsd = Number(process.env.BUDGET_USD ?? '4');
const costPerImageUsd = Number(process.env.COST_PER_IMAGE_USD ?? '0.04');

const trigger = 'JAY_W';
const physique =
  'heavily muscular bodybuilder-level V-tapered build, broad shoulders, thick chest, defined arms and visible abs, dense athletic mass';
const negative =
  'no text, no logo, no watermark, no mirror selfie, no phone in hand, no double biceps pose, no turban, no headscarf, no woven head covering, no extra people, no distorted hands, no plastic skin';

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

function slugify(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || 'version';
}

function anchor(subjectClause: string) {
  return `${trigger}, a 29-year-old Black male builder-founder, ${physique}, ${subjectClause}, calm grounded eyes, trimmed beard, realistic skin texture`;
}

function buildCases(): ProofCase[] {
  return [
    {
      id: 'identity-editorial-close',
      brand: 'parent',
      goal: 'Face, hairline, beard, skin texture, and expression without relying on gym/mirror context.',
      aspect_ratio: '4:5',
      seed: 240101,
      prompt: `${anchor('fresh low taper haircut with visible waves, no head covering, fitted charcoal henley')}. Tight editorial portrait against a warm charcoal seamless backdrop, bronze rim light, direct eye contact, premium magazine photography. ${negative}.`,
    },
    {
      id: 'bbw-workbench-tools',
      brand: 'built-by-ward',
      goal: 'Best contractor/workbench direction while preserving identity and avoiding stock-worker face.',
      aspect_ratio: '3:2',
      seed: 240102,
      prompt: `${anchor('fresh low taper haircut with visible waves, no head covering, lightweight warm gray collared work shirt with sleeves rolled to mid forearm, leather tool belt, cargo work pants')}. Close-up at a wood workbench, hands resting near a circular saw and tape measure, muscular forearms visible, sawdust, golden hour through a shop window, editorial documentary realism. ${negative}.`,
    },
    {
      id: 'ward-tech-dashboard',
      brand: 'ward-tech',
      goal: 'Tech founder plus field/build identity, without turning corporate or losing physique.',
      aspect_ratio: '3:2',
      seed: 240103,
      prompt: `${anchor('clear-frame blue-light tech glasses, fitted olive collared button-down stretched across broad shoulders and chest, sleeves rolled')}. Clean workshop office, three monitors behind him with abstract contractor dashboards, one hand on a coffee mug, warm bronze practical light, software founder authority with field credibility. ${negative}.`,
    },
    {
      id: 'jwm-sponsor-cover',
      brand: 'jay-ward-muscle',
      goal: 'Physique and sponsor-ready gym editorial while keeping the face accurate.',
      aspect_ratio: '4:5',
      seed: 240104,
      prompt: `${anchor('fresh low taper haircut with visible waves, no head covering, black gym stringer with deep armholes, training shorts')}. Premium sponsor-cover gym portrait beside loaded plates and chalk, sweat on skin, controlled breathing, warm overhead spot light, discipline not vanity. ${negative}.`,
    },
    {
      id: 'parent-command-center',
      brand: 'parent',
      goal: 'Generalize identity into the Brand-OS command-center world without losing face, build, or wardrobe rules.',
      aspect_ratio: '16:9',
      seed: 240105,
      prompt: `${anchor('smooth silky black durag laid flat against the head with visible sheen, fitted dark tee pulled across thick chest, dark workwear pants')}. Standing in front of a salvaged multi-monitor command center built from repaired equipment, monitors showing abstract workflows, construction plans on the wall, warm bronze workshop light, powerful grounded expression. ${negative}.`,
    },
  ].slice(0, proofLimit);
}

function outputUrl(output: unknown): string {
  const values = Array.isArray(output) ? output : [output];
  if (!values[0]) throw new Error('prediction returned no output URL');
  return String(values[0]);
}

async function download(url: string, dest: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'replicate-api-proof-cases/0.1',
    },
  });
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  const body = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, body);
}

async function readIndex(indexPath: string) {
  if (!existsSync(indexPath)) return { runs: [] as unknown[] };
  return JSON.parse(await readFile(indexPath, 'utf8'));
}

async function main() {
  const cases = buildCases();
  const estimated = versions.length * cases.length * costPerImageUsd;
  const runId = nowStamp();

  console.log('== JAY_W proof cases via replicate-api ==');
  console.log(`versions: ${versions.length}`);
  for (const v of versions) console.log(`  - ${v}`);
  console.log(`cases: ${cases.length}`);
  console.log(`est cost: $${estimated.toFixed(2)}`);
  console.log(`budget:   $${budgetUsd.toFixed(2)}`);
  console.log(`out:      ${outRoot}`);

  if (estimated > budgetUsd) throw new Error(`estimated $${estimated.toFixed(2)} exceeds budget $${budgetUsd.toFixed(2)}`);

  if (dryRun) {
    for (const c of cases) console.log(`[${c.brand}] ${c.id} seed=${c.seed} ar=${c.aspect_ratio} :: ${c.goal}`);
    return;
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) throw new Error('REPLICATE_API_TOKEN missing');

  const replicate = createReplicate({ apiToken });
  const indexPath = path.join(outRoot, 'proof_runs.json');
  await mkdir(path.join(outRoot, runId), { recursive: true });
  const index = await readIndex(indexPath);
  const runRecord = { id: runId, created_at: new Date().toISOString(), versions, cases, results: [] as ProofResult[] };
  index.runs.push(runRecord);

  for (const version of versions) {
    const versionDir = path.join(outRoot, runId, slugify(version));
    await mkdir(versionDir, { recursive: true });
    for (const c of cases) {
      console.log(`[${version}] ${c.id} ...`);
      const result: ProofResult = { case_id: c.id, version, status: 'starting' };
      try {
        const prediction = await replicate.predictions.create(
          {
            version,
            input: {
              prompt: c.prompt,
              model: 'dev',
              aspect_ratio: c.aspect_ratio,
              num_inference_steps: 32,
              guidance_scale: 3.2,
              lora_scale: 1,
              megapixels: '1',
              num_outputs: 1,
              output_format: 'png',
              output_quality: 95,
              seed: c.seed,
              disable_safety_checker: false,
            },
          },
          { waitSeconds: 60, cancelAfter: '10m' },
        );
        const final =
          prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled'
            ? prediction
            : await replicate.predictions.waitForCompletion(prediction.id);
        result.prediction_id = final.id;
        result.status = final.status;
        result.web_url = final.urls.web;
        result.metrics = final.metrics;
        if (final.status !== 'succeeded') {
          result.error = final.error;
        } else {
          const dest = path.join(versionDir, `${c.id}.png`);
          await download(outputUrl(final.output), dest, apiToken);
          result.output_file = dest;
          console.log(`  -> ${dest}`);
        }
      } catch (err) {
        result.status = 'failed';
        result.error = err instanceof Error ? err.message : err;
        console.log(`  FAILED: ${String(result.error)}`);
      }
      runRecord.results.push(result);
      await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
