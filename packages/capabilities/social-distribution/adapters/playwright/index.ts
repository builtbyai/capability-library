/**
 * index.ts — barrel for the four playwright social-distribution adapters.
 *
 * Consumers (the MJB social-distribution capability's publish job, ad-hoc
 * node scripts, future scheduler hooks) import from here:
 *
 *   import { postToPlatform } from '@multimarcdown/social-distribution-playwright';
 *   await postToPlatform('tiktok', { videoPath, caption, hashtags, brandLaneId });
 *
 * The `postToPlatform` dispatcher fan-routes to the per-platform
 * `postVideo`/`postImage` so the caller doesn't have to switch.
 *
 * The per-platform modules remain individually importable for callers
 * that need finer control (e.g. a test harness wanting to bypass the
 * dispatcher's input validation).
 */
export * from './shared.js';
export { postVideo as postVideoTikTok } from './tiktok/upload.js';
export { postVideo as postVideoInstagram, postImage as postImageInstagram } from './instagram/upload.js';
export { postPost as postFacebook } from './facebook/upload.js';
export { postPin as postPinterest } from './pinterest/upload.js';

import type { PlatformId, PostOptions, PostResult } from './shared.js';
import { postVideo as ttPost } from './tiktok/upload.js';
import { postVideo as igPostVideo, postImage as igPostImage } from './instagram/upload.js';
import { postPost as fbPost } from './facebook/upload.js';
import { postPin as pinPost } from './pinterest/upload.js';

/** Single dispatcher used by the MJB publish job. Picks the right
 *  per-platform entry point based on the platform id and the kind of
 *  media in `opts`. Throws if both `videoPath` and `imagePath` are
 *  missing — the caller is responsible for resolving the intake object
 *  to a local path before calling. */
export async function postToPlatform(
  platform: PlatformId,
  opts: PostOptions,
): Promise<PostResult> {
  if (!opts.videoPath && !opts.imagePath) {
    throw new Error(
      `[social-distribution-playwright] postToPlatform(${platform}): ` +
        `neither videoPath nor imagePath supplied.`,
    );
  }
  switch (platform) {
    case 'tiktok':
      if (!opts.videoPath) {
        throw new Error('TikTok requires videoPath.');
      }
      return ttPost(opts);
    case 'instagram':
      return opts.videoPath ? igPostVideo(opts) : igPostImage(opts);
    case 'facebook':
      return fbPost(opts);
    case 'pinterest':
      return pinPost(opts);
    default: {
      const _exhaustive: never = platform;
      throw new Error(`Unknown platform: ${String(_exhaustive)}`);
    }
  }
}
