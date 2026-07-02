/**
 * tiktok/upload.ts — TikTok video upload via the studio.tiktok.com /
 * tiktok.com/upload web flow, driven by Playwright with a persisted
 * session.
 *
 * Public API:
 *
 *   postVideo({ videoPath, caption, hashtags, brandLaneId, dryRun? })
 *     → { ok, platformPostId?, postUrl?, error?, retryable?, dryRun, platform, brandLaneId }
 *
 * Flow:
 *   1. assertLaneBound (synchronous firewall — throws before browser opens)
 *   2. Launch chromium with persisted storageState
 *   3. Navigate to /upload, detect logged-out → throw with re-setup hint
 *   4. Set file via <input type=file>
 *   5. Wait for the upload progress bar to reach 100%
 *   6. Fill caption (contenteditable) with humanType + interleave hashtags
 *   7. Wait for the Post button to become enabled
 *   8. dryRun=true → log + return without clicking Post
 *      dryRun=false → click Post, wait for confirmation toast / redirect,
 *      extract the platform post id from the success URL or the
 *      profile feed's first item.
 *
 * Selector volatility:
 *   TikTok's upload page is a SPA inside an iframe in some account
 *   regions. Selectors below are the best 2026-grade educated guesses
 *   given that the upload UI has been rewritten ~3x in the last 24
 *   months. Every selector that's likely to drift is marked with a
 *   `// TODO: re-verify selector` comment.
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

const UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload?from=upload';
const UPLOAD_URL_FALLBACK = 'https://www.tiktok.com/upload?lang=en';

/** Heuristic detect: TikTok bounces unauth'd visitors to /login. Also
 *  watch for the upload page rendering a "log in to continue" button. */
async function isLoggedIn(page: Page): Promise<boolean> {
  if (/\/login/.test(page.url())) return false;
  const loginPrompt = page.locator('text=/log in/i').first();
  const visible = await loginPrompt.isVisible({ timeout: 1500 }).catch(() => false);
  return !visible;
}

/** TikTok's upload accepts <input type=file>. The element is hidden but
 *  present in the DOM — setInputFiles works on hidden inputs. */
async function attachVideo(page: Page, videoPath: string): Promise<void> {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 60_000 });
  await fileInput.setInputFiles(videoPath);
}

/** Poll for the upload progress widget to reach a "ready to publish"
 *  state. TikTok uses both `%` text and an SVG ring that animates; we
 *  watch for the Post button to become enabled as the truest signal. */
async function waitForUploadComplete(page: Page): Promise<void> {
  // TODO: re-verify selector — TikTok rotates between
  //   button[data-e2e="post_video_button"]
  //   button:has-text("Post")
  //   button[data-tt="upload_post"]
  const postBtn = page.locator(
    [
      'button[data-e2e="post_video_button"]',
      'button:has-text("Post")',
      'button[data-tt="upload_post"]',
    ].join(', '),
  ).first();
  // Up to 10 minutes for very large uploads on slow networks
  await postBtn.waitFor({ state: 'visible', timeout: 10 * 60 * 1000 });
  await page.waitForFunction(
    (btn) => {
      const el = btn as HTMLButtonElement | null;
      if (!el) return false;
      return !el.disabled && !el.getAttribute('aria-disabled');
    },
    await postBtn.elementHandle(),
    { timeout: 10 * 60 * 1000 },
  );
}

/** Fill the caption + hashtags. TikTok's caption field is a
 *  contenteditable DIV — Playwright's `.fill()` does NOT work on it, so
 *  we click + type. Hashtag autocompletion is finicky; we just type the
 *  raw `#tag ` string and let TikTok parse it. */
async function fillCaption(
  page: Page,
  caption: string,
  hashtags: string[],
): Promise<void> {
  // TODO: re-verify selector — has been `div[contenteditable="true"]`,
  // `div[data-e2e="caption-input"]`, `div[role="combobox"]` at various times.
  const captionEl = page.locator(
    [
      'div[data-e2e="caption-input"]',
      'div[contenteditable="true"][role="combobox"]',
      'div[contenteditable="true"]',
    ].join(', '),
  ).first();
  await captionEl.waitFor({ state: 'visible', timeout: 60_000 });

  // Clear any pre-filled text TikTok inserts (e.g. recent draft restore)
  await captionEl.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  await humanType(captionEl, caption);
  if (hashtags.length) {
    await captionEl.type(' ');
    for (const tag of hashtags) {
      const clean = tag.replace(/^#/, '').replace(/\s+/g, '');
      if (!clean) continue;
      await captionEl.type(`#${clean}`);
      // Wait for the hashtag suggestion popover to render, then dismiss
      // with Escape so we don't accidentally pick a suggested tag.
      await jitterPause(400, 200);
      await page.keyboard.press('Escape').catch(() => {});
      await captionEl.type(' ');
      await jitterPause(150, 150);
    }
  }
}

/** Extract the platform post id from a success URL. Returns null on
 *  best-effort failure — the caller logs and continues. */
function parsePostIdFromUrl(url: string): string | null {
  // https://www.tiktok.com/@user/video/1234567890123456789
  const m = /\/video\/(\d{6,})/.exec(url);
  return m ? m[1] : null;
}

/** Wait for TikTok to confirm the publish. Two possible signals: a
 *  redirect to the user's profile / posted page, or the "Your video is
 *  being uploaded" toast resolving to "Manage posts". */
async function waitForPublishConfirmation(
  page: Page,
): Promise<{ url: string; postId: string | null }> {
  const start = Date.now();
  const deadline = start + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    const postId = parsePostIdFromUrl(url);
    if (postId) return { url, postId };

    // TODO: re-verify selector — the success toast text varies by region.
    const toast = page
      .locator('text=/(your video has been uploaded|posted|published)/i')
      .first();
    const toastVisible = await toast.isVisible({ timeout: 500 }).catch(() => false);
    if (toastVisible) {
      return { url, postId: null };
    }
    await page.waitForTimeout(2000);
  }
  throw new Error('TikTok publish confirmation not received within 5 minutes.');
}

/**
 * postVideo — entry point used by the MJB publish job.
 */
export async function postVideo(opts: PostOptions): Promise<PostResult> {
  const dryRun = !!opts.dryRun;
  if (!opts.videoPath) {
    return makeResult('tiktok', opts.brandLaneId, {
      ok: false,
      error: 'videoPath is required for TikTok',
      dryRun,
    });
  }

  // 1. Brand-lane firewall — fails before any browser work.
  let connectorAccount: string;
  try {
    connectorAccount = await assertLaneBound(opts.brandLaneId, 'tiktok');
  } catch (e) {
    return makeResult('tiktok', opts.brandLaneId, {
      ok: false,
      error: (e as Error).message,
      retryable: false,
      dryRun,
    });
  }
  console.log(
    `[tiktok] brand-lane ok: lane=${opts.brandLaneId} → connector=${connectorAccount}`,
  );

  // 2. Load persisted session.
  const storageStatePath = await loadSession('tiktok');

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

    // 3. Navigate to upload; if redirected to /login, the session expired.
    await page.goto(UPLOAD_URL, { waitUntil: 'domcontentloaded' });
    await jitterPause(1500, 1000);
    if (!(await isLoggedIn(page))) {
      // Try the legacy upload URL once before giving up.
      await page.goto(UPLOAD_URL_FALLBACK, { waitUntil: 'domcontentloaded' });
      await jitterPause(1500, 1000);
      if (!(await isLoggedIn(page))) {
        throw new Error(
          'TikTok session expired. Re-run: npx playwright test --project=setup --grep tiktok',
        );
      }
    }

    // 4. Attach the video file.
    await attachVideo(page, opts.videoPath);
    console.log(`[tiktok] file attached: ${opts.videoPath}`);

    // 5. Wait for upload to finish (Post button becomes enabled).
    await waitForUploadComplete(page);
    console.log('[tiktok] upload complete');

    // 6. Caption + hashtags.
    await fillCaption(page, opts.caption, opts.hashtags);
    console.log('[tiktok] caption filled');

    // Allow TikTok to re-run its cover-frame extractor, etc.
    await jitterPause(2500, 1500);

    if (dryRun) {
      console.log(
        '[tiktok] DRY RUN — would click Post now. Caption + file attached, session valid.',
      );
      return makeResult('tiktok', opts.brandLaneId, { ok: true, dryRun: true });
    }

    // 7. Click Post.
    // TODO: re-verify selector — same drift surface as the wait above.
    const postBtn = page.locator(
      [
        'button[data-e2e="post_video_button"]',
        'button:has-text("Post")',
        'button[data-tt="upload_post"]',
      ].join(', '),
    ).first();
    await postBtn.click();

    // 8. Confirm + extract post id.
    const { url, postId } = await waitForPublishConfirmation(page);
    console.log(`[tiktok] published: ${url} (id=${postId ?? 'unknown'})`);

    return makeResult('tiktok', opts.brandLaneId, {
      ok: true,
      platformPostId: postId ?? undefined,
      postUrl: url,
      dryRun: false,
    });
  } catch (e) {
    const msg = (e as Error).message;
    const retryable =
      /timeout|network|net::|ECONN|disconnected|terminated|context closed/i.test(msg);
    return makeResult('tiktok', opts.brandLaneId, {
      ok: false,
      error: msg,
      retryable,
      dryRun,
    });
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
