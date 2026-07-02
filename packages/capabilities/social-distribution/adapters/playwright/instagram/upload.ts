/**
 * instagram/upload.ts — Instagram Reel + single-image upload via the
 * standard www.instagram.com web flow.
 *
 * Public API:
 *   postVideo(opts)  — uploads a reel (9:16 preferred; square accepted)
 *   postImage(opts)  — uploads a single-image feed post
 *
 * Notes:
 *   - Instagram's web upload is gated on a small DM-style "Create"
 *     popover. The flow:
 *       1. Click the "Create" nav button
 *       2. Click the "Select from computer" CTA in the popover
 *       3. setInputFiles on the hidden input
 *       4. Click through the 3-step wizard (crop, edit, share)
 *       5. Fill caption + alt text + (optional) tagged accounts
 *       6. Click "Share"
 *       7. Wait for the success toast / "Your reel has been shared"
 *
 *   - We do NOT toggle "Also share to Facebook" — that route is owned
 *     by the dedicated Facebook adapter and the cross-post toggle
 *     would bypass the brand-lane firewall.
 *
 *   - Instagram supports natively scheduling reels from web for
 *     Professional accounts; this adapter leaves that toggle alone and
 *     relies on the caller's queue to delay-publish. If a future caller
 *     wants native scheduling, pass `platformOptions.scheduleNative = true`
 *     and wire the date-picker selector additions below.
 */
import { chromium, type Page, type BrowserContext, type Locator } from 'playwright';
import {
  assertLaneBound,
  humanType,
  jitterPause,
  loadSession,
  makeResult,
  type PostOptions,
  type PostResult,
} from '../shared.js';

const HOME_URL = 'https://www.instagram.com/';

async function isLoggedIn(page: Page): Promise<boolean> {
  if (/\/accounts\/login/.test(page.url())) return false;
  // The Create button only renders for authenticated users.
  // TODO: re-verify selector — IG sometimes labels it 'New post' or
  // shows only an icon (svg[aria-label="New post"]).
  const create = page.locator(
    'svg[aria-label="New post"], a[href="#"]:has-text("Create"), [role="link"]:has-text("Create")',
  ).first();
  return await create.isVisible({ timeout: 5000 }).catch(() => false);
}

/** Click the Create nav entry and reach the file-picker popover. */
async function openCreateDialog(page: Page): Promise<Locator> {
  // TODO: re-verify selector — varies by viewport and account type.
  const createBtn = page.locator(
    'svg[aria-label="New post"], a[href="#"]:has-text("Create"), [role="link"]:has-text("Create")',
  ).first();
  await createBtn.click();
  // Some sidebar variants surface a submenu (Post / Reel / Story).
  // Pick whichever matches the upload kind. We pick "Post" for image
  // and "Reel" for video; the caller may override via platformOptions.
  return page.locator('div[role="dialog"]').first();
}

async function attachFile(page: Page, filePath: string): Promise<void> {
  // The dialog's "Select from computer" button hides a <input type=file>.
  // Using setInputFiles directly on the hidden input is more reliable
  // than clicking the visible button + waiting for the OS picker.
  const input = page.locator('input[type="file"][accept*="image"], input[type="file"][accept*="video"], input[type="file"]').first();
  await input.waitFor({ state: 'attached', timeout: 30_000 });
  await input.setInputFiles(filePath);
}

/** Walk the multi-step wizard (Crop → Edit → Share). Each step uses the
 *  same "Next" button so we just click 'Next' twice. */
async function clickThroughWizard(page: Page): Promise<void> {
  for (let i = 0; i < 2; i++) {
    // TODO: re-verify selector — IG sometimes uses '_acan' / data-testid
    const next = page.locator('button:has-text("Next"), div[role="button"]:has-text("Next")').first();
    await next.waitFor({ state: 'visible', timeout: 60_000 });
    await next.click();
    await jitterPause(1500, 800);
  }
}

async function fillCaption(page: Page, caption: string, hashtags: string[]): Promise<void> {
  // TODO: re-verify selector — IG uses a contenteditable with aria-label
  // 'Write a caption...' in English; localized accounts will differ.
  const captionEl = page.locator(
    'div[aria-label="Write a caption..."], div[contenteditable="true"][role="textbox"]',
  ).first();
  await captionEl.waitFor({ state: 'visible', timeout: 60_000 });
  await captionEl.click();
  const full = [caption, ...hashtags.map((h) => `#${h.replace(/^#/, '')}`)].join(' ');
  await humanType(captionEl, full);
}

async function clickShare(page: Page): Promise<void> {
  // TODO: re-verify selector — has been 'Share' and 'Post' in different rollouts.
  const share = page.locator('button:has-text("Share"), div[role="button"]:has-text("Share")').first();
  await share.click();
}

async function waitForShareConfirmation(page: Page): Promise<{ url: string; postId: string | null }> {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    // TODO: re-verify selector — the toast text changes per locale + media kind.
    const toast = page.locator('text=/(your (reel|post) has been shared|post shared)/i').first();
    const visible = await toast.isVisible({ timeout: 500 }).catch(() => false);
    if (visible) {
      // IG's web upload does NOT immediately surface the new post URL.
      // The most reliable route is to navigate to the user's profile
      // and read the first post's href. We delegate that to the caller
      // for now and return null postId.
      return { url: page.url(), postId: null };
    }
    await page.waitForTimeout(2000);
  }
  throw new Error('Instagram share confirmation not received within 5 minutes.');
}

async function dispatch(
  opts: PostOptions,
  kind: 'video' | 'image',
): Promise<PostResult> {
  const dryRun = !!opts.dryRun;
  const filePath = kind === 'video' ? opts.videoPath : opts.imagePath;
  if (!filePath) {
    return makeResult('instagram', opts.brandLaneId, {
      ok: false,
      error: `${kind === 'video' ? 'videoPath' : 'imagePath'} is required for Instagram`,
      dryRun,
    });
  }

  let connectorAccount: string;
  try {
    connectorAccount = await assertLaneBound(opts.brandLaneId, 'instagram');
  } catch (e) {
    return makeResult('instagram', opts.brandLaneId, {
      ok: false,
      error: (e as Error).message,
      retryable: false,
      dryRun,
    });
  }
  console.log(
    `[instagram] brand-lane ok: lane=${opts.brandLaneId} → connector=${connectorAccount}`,
  );

  const storageStatePath = await loadSession('instagram');

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
        'Instagram session expired. Re-run: npx playwright test --project=setup --grep instagram',
      );
    }

    await openCreateDialog(page);
    await jitterPause(750, 500);
    await attachFile(page, filePath);
    console.log(`[instagram] file attached: ${filePath}`);

    // Reels prompt: when IG detects a vertical video, it asks the user
    // whether to upload as a Reel. Click "OK" if it appears.
    const reelPrompt = page.locator('button:has-text("OK"), button:has-text("Reel")').first();
    if (await reelPrompt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reelPrompt.click().catch(() => {});
    }

    await clickThroughWizard(page);
    console.log('[instagram] wizard advanced to Share step');

    await fillCaption(page, opts.caption, opts.hashtags);
    console.log('[instagram] caption filled');

    await jitterPause(1500, 1000);

    if (dryRun) {
      console.log(
        '[instagram] DRY RUN — would click Share now. File attached, caption set, session valid.',
      );
      return makeResult('instagram', opts.brandLaneId, { ok: true, dryRun: true });
    }

    await clickShare(page);
    const { url, postId } = await waitForShareConfirmation(page);
    console.log(`[instagram] shared. landing url=${url}`);

    return makeResult('instagram', opts.brandLaneId, {
      ok: true,
      platformPostId: postId ?? undefined,
      postUrl: url,
      dryRun: false,
    });
  } catch (e) {
    const msg = (e as Error).message;
    const retryable = /timeout|network|net::|ECONN|disconnected/i.test(msg);
    return makeResult('instagram', opts.brandLaneId, {
      ok: false,
      error: msg,
      retryable,
      dryRun,
    });
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

export async function postVideo(opts: PostOptions): Promise<PostResult> {
  return dispatch(opts, 'video');
}
export async function postImage(opts: PostOptions): Promise<PostResult> {
  return dispatch(opts, 'image');
}
