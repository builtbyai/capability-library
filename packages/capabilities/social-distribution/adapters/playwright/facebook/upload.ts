/**
 * facebook/upload.ts — Facebook feed and Page post via the standard
 * www.facebook.com composer.
 *
 * Public API:
 *   postPost(opts) — uploads an image OR video to either the personal
 *     feed or a specific Page, depending on `platformOptions`.
 *
 * platformOptions:
 *   targetPageId?: string   — when set, the composer is opened from
 *                              facebook.com/<pageId> instead of the
 *                              personal feed. The session must own the
 *                              Page (manager / editor / admin role).
 *   audience?: 'public' | 'friends' | 'only-me'
 *                              Only applies to personal feed; ignored
 *                              for Page posts. Default 'public'.
 *
 * The Facebook composer is one of the more stable UIs of the four:
 *   1. Click the top-of-feed "What's on your mind" card
 *   2. A modal opens with a Photos/Video icon
 *   3. Click it → setInputFiles on the hidden file input
 *   4. Wait for upload thumbnail to render
 *   5. Type caption into the contenteditable above
 *   6. Click Post
 *
 * Selectors below are educated guesses; FB rotates `aria-label` text in
 * minor releases (e.g. "Photo/video" → "Photo/video, GIF").
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import {
  assertLaneBound,
  humanType,
  jitterPause,
  loadSession,
  makeResult,
  type PostOptions,
  type PostResult,
} from '../shared.js';

const HOME_URL = 'https://www.facebook.com/';

async function isLoggedIn(page: Page): Promise<boolean> {
  if (/\/login|\/checkpoint/.test(page.url())) return false;
  // The composer card is only visible to authenticated users.
  // TODO: re-verify selector — FB rotates "What's on your mind" copy
  // and sometimes uses `aria-label` instead of inner text.
  const composer = page.locator(
    'div[role="button"]:has-text("What\'s on your mind"), span:has-text("What\'s on your mind")',
  ).first();
  return await composer.isVisible({ timeout: 8000 }).catch(() => false);
}

async function openComposer(page: Page, targetPageId?: string): Promise<void> {
  if (targetPageId) {
    await page.goto(`https://www.facebook.com/${targetPageId}`, {
      waitUntil: 'domcontentloaded',
    });
    await jitterPause(2000, 1000);
  }
  // TODO: re-verify selector — the composer trigger has been a div[role=button]
  // for years, but the visible text drifts. We OR on both common variants.
  const composer = page.locator(
    'div[role="button"]:has-text("What\'s on your mind"), div[role="button"]:has-text("Create a post"), span:has-text("What\'s on your mind")',
  ).first();
  await composer.click();
  // The Create Post modal renders as a role=dialog.
  await page.locator('div[role="dialog"]').first().waitFor({ state: 'visible', timeout: 30_000 });
}

async function attachMedia(page: Page, filePath: string): Promise<void> {
  // Click the Photo/Video CTA, which exposes the hidden file input.
  // TODO: re-verify selector — has been 'Photo/video', 'Photo/video, GIF',
  // and 'Add Photo/Video' across recent rollouts.
  const photoBtn = page.locator(
    'div[role="dialog"] div[aria-label*="Photo"], div[role="dialog"] div[aria-label*="photo"]',
  ).first();
  await photoBtn.click().catch(() => {});
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ state: 'attached', timeout: 30_000 });
  await input.setInputFiles(filePath);
}

async function waitForMediaThumbnail(page: Page): Promise<void> {
  // The composer renders a preview tile once upload starts.
  // TODO: re-verify selector — FB nests this under multiple wrapper divs
  // with hashed class names. Best stable anchor is a generated <img>
  // OR <video> tag inside the dialog.
  await page.locator('div[role="dialog"] img, div[role="dialog"] video').first().waitFor({
    state: 'visible',
    timeout: 5 * 60 * 1000,
  });
}

async function fillCaption(page: Page, caption: string, hashtags: string[]): Promise<void> {
  // TODO: re-verify selector — FB caption is a contenteditable with
  // aria-label 'What's on your mind, <name>?' (interpolates user name).
  const captionEl = page.locator(
    'div[role="dialog"] div[contenteditable="true"][role="textbox"], div[role="dialog"] div[contenteditable="true"]',
  ).first();
  await captionEl.click();
  const full = [caption, ...hashtags.map((h) => `#${h.replace(/^#/, '')}`)].join(' ');
  await humanType(captionEl, full);
}

async function clickPost(page: Page): Promise<void> {
  // TODO: re-verify selector — FB uses 'Post' and sometimes 'Publish' /
  // 'Share Now' depending on whether the composer was opened on a Page.
  const post = page.locator(
    'div[role="dialog"] div[aria-label="Post"], div[role="dialog"] div[aria-label="Publish"], div[role="dialog"] div[aria-label="Share Now"]',
  ).first();
  await post.waitFor({ state: 'visible', timeout: 30_000 });
  await post.click();
}

async function waitForConfirmation(page: Page): Promise<{ url: string; postId: string | null }> {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    // The composer dialog disappears on successful post.
    const dialog = page.locator('div[role="dialog"]').first();
    const stillVisible = await dialog.isVisible({ timeout: 500 }).catch(() => false);
    if (!stillVisible) {
      // FB sometimes surfaces a toast with the post URL, but the most
      // reliable read is the first feed item's `aria-labelledby`-linked
      // anchor. We return the current URL; postId extraction is a
      // separate follow-up step (FB graph permalink fetcher).
      return { url: page.url(), postId: null };
    }
    await page.waitForTimeout(2000);
  }
  throw new Error('Facebook post confirmation not received within 5 minutes.');
}

export async function postPost(opts: PostOptions): Promise<PostResult> {
  const dryRun = !!opts.dryRun;
  const filePath = opts.videoPath ?? opts.imagePath;
  if (!filePath) {
    return makeResult('facebook', opts.brandLaneId, {
      ok: false,
      error: 'Facebook adapter requires either videoPath or imagePath',
      dryRun,
    });
  }
  const targetPageId = (opts.platformOptions?.targetPageId as string | undefined) ?? undefined;

  let connectorAccount: string;
  try {
    connectorAccount = await assertLaneBound(opts.brandLaneId, 'facebook');
  } catch (e) {
    return makeResult('facebook', opts.brandLaneId, {
      ok: false,
      error: (e as Error).message,
      retryable: false,
      dryRun,
    });
  }
  console.log(
    `[facebook] brand-lane ok: lane=${opts.brandLaneId} → connector=${connectorAccount}` +
      (targetPageId ? ` (page=${targetPageId})` : ' (personal feed)'),
  );

  const storageStatePath = await loadSession('facebook');

  let context: BrowserContext | null = null;
  try {
    const browser = await chromium.launch({
      headless: process.env.HEADLESS === '1',
      channel: process.env.PW_CHANNEL || undefined,
    });
    context = await browser.newContext({
      storageState: storageStatePath,
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
    });
    const page = await context.newPage();

    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
    await jitterPause(1500, 1000);
    if (!(await isLoggedIn(page))) {
      throw new Error(
        'Facebook session expired. Re-run: npx playwright test --project=setup --grep facebook',
      );
    }

    await openComposer(page, targetPageId);
    await jitterPause(750, 500);
    await attachMedia(page, filePath);
    console.log(`[facebook] file attached: ${filePath}`);

    await waitForMediaThumbnail(page);
    console.log('[facebook] media thumbnail rendered');

    await fillCaption(page, opts.caption, opts.hashtags);
    console.log('[facebook] caption filled');

    await jitterPause(1500, 1000);

    if (dryRun) {
      console.log('[facebook] DRY RUN — would click Post now.');
      return makeResult('facebook', opts.brandLaneId, { ok: true, dryRun: true });
    }

    await clickPost(page);
    const { url, postId } = await waitForConfirmation(page);
    console.log(`[facebook] posted. landing url=${url}`);

    return makeResult('facebook', opts.brandLaneId, {
      ok: true,
      platformPostId: postId ?? undefined,
      postUrl: url,
      dryRun: false,
    });
  } catch (e) {
    const msg = (e as Error).message;
    const retryable = /timeout|network|net::|ECONN|disconnected/i.test(msg);
    return makeResult('facebook', opts.brandLaneId, {
      ok: false,
      error: msg,
      retryable,
      dryRun,
    });
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
