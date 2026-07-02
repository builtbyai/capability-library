/**
 * facebook/upload.test.ts — dry-run smoke for the FB post flow.
 *
 * @dry tag. Validates firewall + session + composer flow up to Post click.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { postPost } from './upload.js';

const FIXTURE =
  process.env.MM_FB_FIXTURE ?? path.resolve(process.cwd(), 'fixtures', 'sample.mp4');
const LANE = process.env.MM_FB_LANE ?? 'mjb-home-finds';

test('facebook :: postPost dry-run @dry', async () => {
  const result = await postPost({
    videoPath: FIXTURE,
    caption: 'dry-run smoke — should not post',
    hashtags: ['mjbtest'],
    brandLaneId: LANE,
    dryRun: true,
  });

  expect(result.platform).toBe('facebook');
  expect(result.dryRun).toBe(true);
  expect(result.ok).toBe(true);
});
