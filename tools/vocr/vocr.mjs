#!/usr/bin/env node
/**
 * vocr — vision OCR via local Ollama (qwen2.5vl / llama3.2-vision / llava).
 * In-library version of the user's ~/.claude/tools/vocr.mjs. Hits Ollama at
 * 127.0.0.1:11434 by default; costs nothing; avoids `Argument list too long`
 * from inline base64.
 *
 * Run:   node tools/vocr/vocr.mjs <image.png> [more.png ...]
 *        --model qwen2.5vl:32b
 *        --prompt "describe this in detail"
 *        --host http://10.10.10.2:11434     (jmain remote)
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULTS = {
  model: 'llava:13b',
  host: 'http://127.0.0.1:11434',
  prompt: 'Describe this image in 3-5 sentences. Be specific about layout, text content (OCR any visible words), colors, and notable elements.',
};

const args = process.argv.slice(2);
const opts = { ...DEFAULTS, images: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--model') opts.model = args[++i];
  else if (a === '--host') opts.host = args[++i];
  else if (a === '--prompt') opts.prompt = args[++i];
  else opts.images.push(a);
}

if (opts.images.length === 0) {
  console.error('usage: node tools/vocr/vocr.mjs <image.png> [more.png ...] [--model M] [--prompt P] [--host URL]');
  process.exit(2);
}

for (const path of opts.images) {
  const abs = resolve(path);
  const bytes = await readFile(abs);
  const b64 = bytes.toString('base64');
  const body = {
    model: opts.model,
    prompt: opts.prompt,
    images: [b64],
    stream: false,
  };
  const t0 = Date.now();
  const res = await fetch(`${opts.host}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`${abs}: HTTP ${res.status}: ${await res.text()}`);
    continue;
  }
  const data = await res.json();
  const wallMs = Date.now() - t0;
  console.log(`\n=== ${abs} (${opts.model}, ${wallMs}ms) ===`);
  console.log(data.response.trim());
}
