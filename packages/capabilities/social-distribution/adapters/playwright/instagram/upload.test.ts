/**
 * instagram/upload.test.ts — dry-run smoke for the IG reel upload.
 *
 * @dry tag — never produces a real post. Validates that:
 *   - the brand-lane firewall passes for an IG-bound lane
 *   - the saved session is valid
 *   - the wizard reaches the Share step
 *   - dryRun=true halts before clicking Share
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { postVideo } from './upload.js';

const FIXTURE =
  process.env.MM_IG_FIXTURE ?? path.resolve(process.cwd(), 'fixtures', 'sample-reel.mp4');
const LANE = process.env.MM_IG_LANE ?? 'mjb-home-finds';

test('instagram :: postVideo dry-run @dry', async () => {
  const result = await postVideo({
    videoPath: FIXTURE,
    caption: 'dry-run smoke — should not post',
    hashtags: ['mjbtest'],
    brandLaneId: LANE,
    dryRun: true,
  });

  expect(result.platform).toBe('instagram');
  expect(result.dryRun).toBe(true);
  expect(result.ok).toBe(true);
  expect(result.postUrl).toBeUndefined();
});
