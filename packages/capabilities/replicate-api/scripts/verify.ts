/**
 * Walk the replicate-api diagnostic ladder against a real token.
 *
 *   REPLICATE_API_TOKEN=r8_... npx tsx scripts/verify.ts
 *
 * Exits non-zero on the first failed rung.
 */
import { createReplicate } from '../backend/index.js';

const HELLO_WORLD_VERSION =
  'replicate/hello-world:5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa';

async function main() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error('REPLICATE_API_TOKEN is required');
    process.exit(2);
  }

  const replicate = createReplicate({ apiToken: token });

  // rung 1 — token + account
  const account = await replicate.account.get();
  console.log(`[1/3] account.get -> ${account.type}:${account.username}`);

  // rung 2 — hardware catalog
  const hardware = await replicate.hardware.list();
  if (!hardware.some((h) => h.sku === 'cpu')) {
    throw new Error('hardware.list missing cpu SKU');
  }
  console.log(`[2/3] hardware.list -> ${hardware.length} SKUs`);

  // rung 3 — smoke prediction
  const created = await replicate.predictions.create(
    {
      version: HELLO_WORLD_VERSION,
      input: { text: 'diagnostics' },
    },
    { waitSeconds: 30 },
  );
  const final = await replicate.predictions.waitForCompletion(created.id, {
    timeoutMs: 120_000,
  });
  if (final.status !== 'succeeded') {
    throw new Error(
      `prediction terminal status was ${final.status}: ${JSON.stringify(final.error)}`,
    );
  }
  if (final.output !== 'hello diagnostics') {
    throw new Error(`unexpected output: ${JSON.stringify(final.output)}`);
  }
  console.log(`[3/3] hello-world prediction -> ${final.output}`);

  console.log('verify: PASS');
}

main().catch((err) => {
  console.error('verify: FAIL');
  console.error(err);
  process.exit(1);
});
