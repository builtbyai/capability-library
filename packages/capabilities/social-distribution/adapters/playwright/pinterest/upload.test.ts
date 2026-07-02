/**
 * pinterest/upload.test.ts — dry-run smoke for the Pinterest pin flow.
 *
 * @dry tag. Validates firewall + session + create-tool flow up to
 * Publish click. boardId is optional in dry-run mode (the adapter
 * only requires it on a real publish).
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { postPin } from './upload.js';

const FIXTURE =
  process.env.MM_PIN_FIXTURE ?? path.resolve(process.cwd(), 'fixtures', 'sample.jpg');
const LANE = process.env.MM_PIN_LANE ?? 'mjb-home-finds';

test('pinterest :: postPin dry-run @dry', async () => {
  const result = await postPin({
    imagePath: FIXTURE,
    caption: 'dry-run smoke — should not publish',
    hashtags: ['mjbtest'],
    brandLaneId: LANE,
    dryRun: true,
    platformOptions: {
      title: 'mjb dry run',
      altText: 'Smoke-test pin; do not publish',
      destinationUrl: 'https://example.com/smoke',
    },
  });

  expect(result.platform).toBe('pinterest');
  expect(result.dryRun).toBe(true);
  expect(result.ok).toBe(true);
});
