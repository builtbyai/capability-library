/**
 * tiktok/upload.test.ts — dry-run smoke test for the TikTok adapter.
 *
 * Tagged @dry so it can run in CI without producing a real post. The
 * test asserts that the firewall + session preflight + UI flow up to
 * the Post-button click all succeed, and that the dry-run flag stops
 * execution before publish.
 *
 * Required for a green run:
 *   - playwright/.auth/tiktok.json exists (run login.setup.ts first)
 *   - config/mjb/brand-lanes.json has a `tiktok` connector bound for
 *     the lane used in the test (MM_BRAND_LANES_PATH override OK)
 *   - A sample video file at the path in `MM_TT_FIXTURE` (defaults to
 *     ./fixtures/sample.mp4 — operator supplies the file)
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { postVideo } from './upload.js';

const FIXTURE =
  process.env.MM_TT_FIXTURE ?? path.resolve(process.cwd(), 'fixtures', 'sample.mp4');
const LANE = process.env.MM_TT_LANE ?? 'mjb-home-finds';

test('tiktok :: postVideo dry-run @dry', async () => {
  const result = await postVideo({
    videoPath: FIXTURE,
    caption: 'dry-run smoke test — should not actually post',
    hashtags: ['mjbtest', 'donotpublish'],
    brandLaneId: LANE,
    dryRun: true,
  });

  expect(result.platform).toBe('tiktok');
  expect(result.dryRun).toBe(true);
  // ok=true means the firewall passed, the session was valid, the file
  // attached, the upload progressed, and the caption was filled. The
  // adapter then short-circuited before clicking Post.
  expect(result.ok).toBe(true);
  expect(result.platformPostId).toBeUndefined();
  expect(result.postUrl).toBeUndefined();
});
