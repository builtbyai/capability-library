/**
 * pinterest/upload.ts — create a Pinterest Pin (image or video) via the
 * standard www.pinterest.com/pin-creation-tool/ web flow.
 *
 * Public API:
 *   postPin(opts) — uploads an image (preferred) or video, selects a
 *     board, fills title + caption + alt text, optionally adds a
 *     destination URL, clicks Publish.
 *
 * platformOptions:
 *   boardId?:      string  — the Pinterest board id (or board name to
 *                            search). Required for a publish. The
 *                            adapter throws if missing AND `dryRun=false`.
 *   altText?:      string  — accessibility alt text. Default: caption.
 *   destinationUrl?: string  — outbound link the Pin points to. Usually
 *                            the funnel-builder tracking URL.
 *   title?:        string  — optional Pin title (shown above the body).
 *                            Default: first 100 chars of caption.
 *
 * Selector volatility:
 *   Pinterest renames its `data-test-id` attributes more rarely than
 *   TikTok or Instagram, but the board-selector dropdown is custom-
 *   rendered and is the most likely break point.
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

const CREATE_URL = 'https://www.pinterest.com/pin-creation-tool/';

async function isLoggedIn(page: Page): Promise<boolean> {
  if (/\/login/.test(page.url())) return false;
  // The create tool route 302s to /login if unauthenticated.
  return !/\/login/.test(page.url());
}

async function attachMedia(page: Page, filePath: string): Promise<void> {
  // TODO: re-verify selector — has been data-test-id="storyboard-upload-input"
  // and data-test-id="media-upload-input" at various times.
  const input = page.locator(
    'input[type="file"][data-test-id*="upload"], input[type="file"]',
  ).first();
  await input.waitFor({ state: 'attached', timeout: 30_000 });
  await input.setInputFiles(filePath);
}

async function fillTextFields(
  page: Page,
  title: string,
  caption: string,
  hashtags: string[],
  altText: string,
  destinationUrl?: string,
): Promise<void> {
  // Title
  // TODO: re-verify selector — data-test-id="pin-draft-title".
  const titleEl = page.locator(
    'textarea[data-test-id="pin-draft-title"], input[name="title"], textarea[placeholder*="Add a title"]',
  ).first();
  if (await titleEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    await titleEl.click();
    await humanType(titleEl, title);
  }

  // Description / caption (Pinterest calls it "About this Pin")
  // TODO: re-verify selector — data-test-id="pin-draft-description"
  const descEl = page.locator(
    '[data-test-id="pin-draft-description"] [contenteditable="true"], div[contenteditable="true"][role="textbox"], textarea[name="description"]',
  ).first();
  await descEl.click();
  const fullCaption = [caption, ...hashtags.map((h) => `#${h.replace(/^#/, '')}`)].join(' ');
  await humanType(descEl, fullCaption);

  // Destination link
  if (destinationUrl) {
    // TODO: re-verify selector — has been data-test-id="pin-draft-link".
    const linkEl = page.locator(
      'input[data-test-id="pin-draft-link"], input[name="link"], input[placeholder*="Add a link"]',
    ).first();
    if (await linkEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await linkEl.click();
      await linkEl.fill(destinationUrl);
    }
  }

  // Alt text (only present after the operator clicks "Add alt text")
  // TODO: re-verify selector — alt input is hidden behind a toggle in
  // some account variants. We try and skip if not present.
  const altToggle = page.locator('button:has-text("alt text"), a:has-text("alt text")').first();
  if (await altToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
    await altToggle.click().catch(() => {});
    const altEl = page.locator(
      'textarea[name="altText"], textarea[placeholder*="alt text"], textarea[aria-label*="alt text"]',
    ).first();
    if (await altEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await altEl.click();
      await humanType(altEl, altText);
    }
  }
}

async function pickBoard(page: Page, boardIdOrName?: string): Promise<void> {
  if (!boardIdOrName) return;
  // TODO: re-verify selector — board picker is a popover with its own
  // search input. Has been data-test-id="board-dropdown-select-button".
  const dropdown = page.locator(
    '[data-test-id="board-dropdown-select-button"], button:has-text("Choose a board"), button:has-text("Select board")',
  ).first();
  await dropdown.click();
  const search = page.locator(
    'input[placeholder*="Search"], input[type="search"], [data-test-id="board-dropdown-search-field"]',
  ).first();
  await search.waitFor({ state: 'visible', timeout: 10_000 });
  await search.fill(boardIdOrName);
  await jitterPause(500, 300);
  // Pick the first match.
  const firstResult = page.locator('[data-test-id="board-row"], [role="option"]').first();
  await firstResult.click();
}

async function clickPublish(page: Page): Promise<void> {
  // TODO: re-verify selector — has been data-test-id="board-dropdown-save-button"
  // and a literal Publish button across redesigns.
  const publish = page.locator(
    'button[data-test-id="board-dropdown-save-button"], button:has-text("Publish"), button:has-text("Save")',
  ).first();
  await publish.waitFor({ state: 'visible', timeout: 30_000 });
  await publish.click();
}

async function waitForPinConfirmation(page: Page): Promise<{ url: string; postId: string | null }> {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const url = page.url();
    // Pinterest redirects to /pin/<id>/ on a successful publish.
    const m = /\/pin\/(\d+)\//.exec(url);
    if (m) return { url, postId: m[1] };
    await page.waitForTimeout(2000);
  }
  throw new Error('Pinterest publish confirmation not received within 5 minutes.');
}

export async function postPin(opts: PostOptions): Promise<PostResult> {
  const dryRun = !!opts.dryRun;
  const filePath = opts.imagePath ?? opts.videoPath;
  if (!filePath) {
    return makeResult('pinterest', opts.brandLaneId, {
      ok: false,
      error: 'Pinterest adapter requires either imagePath or videoPath',
      dryRun,
    });
  }

  const platformOpts = opts.platformOptions ?? {};
  const boardId = platformOpts.boardId as string | undefined;
  const altText = (platformOpts.altText as string | undefined) ?? opts.caption.slice(0, 500);
  const destinationUrl = platformOpts.destinationUrl as string | undefined;
  const title = (platformOpts.title as string | undefined) ?? opts.caption.slice(0, 100);

  if (!dryRun && !boardId) {
    return makeResult('pinterest', opts.brandLaneId, {
      ok: false,
      error: 'platformOptions.boardId is required for Pinterest publishes',
      dryRun,
    });
  }

  let connectorAccount: string;
  try {
    connectorAccount = await assertLaneBound(opts.brandLaneId, 'pinterest');
  } catch (e) {
    return makeResult('pinterest', opts.brandLaneId, {
      ok: false,
      error: (e as Error).message,
      retryable: false,
      dryRun,
    });
  }
  console.log(
    `[pinterest] brand-lane ok: lane=${opts.brandLaneId} → connector=${connectorAccount}`,
  );

  const storageStatePath = await loadSession('pinterest');

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

    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });
    await jitterPause(1500, 1000);
    if (!(await isLoggedIn(page))) {
      throw new Error(
        'Pinterest session expired. Re-run: npx playwright test --project=setup --grep pinterest',
      );
    }

    await attachMedia(page, filePath);
    console.log(`[pinterest] file attached: ${filePath}`);

    // Pinterest renders the preview canvas after a short upload step.
    await page.locator('img, video').first().waitFor({ state: 'visible', timeout: 60_000 });
    await jitterPause(1000, 500);

    await fillTextFields(page, title, opts.caption, opts.hashtags, altText, destinationUrl);
    console.log('[pinterest] text fields filled');

    if (boardId) {
      await pickBoard(page, boardId);
      console.log(`[pinterest] board selected: ${boardId}`);
    }

    await jitterPause(1500, 1000);

    if (dryRun) {
      console.log('[pinterest] DRY RUN — would click Publish now.');
      return makeResult('pinterest', opts.brandLaneId, { ok: true, dryRun: true });
    }

    await clickPublish(page);
    const { url, postId } = await waitForPinConfirmation(page);
    console.log(`[pinterest] published: ${url} (id=${postId ?? 'unknown'})`);

    return makeResult('pinterest', opts.brandLaneId, {
      ok: true,
      platformPostId: postId ?? undefined,
      postUrl: url,
      dryRun: false,
    });
  } catch (e) {
    const msg = (e as Error).message;
    const retryable = /timeout|network|net::|ECONN|disconnected/i.test(msg);
    return makeResult('pinterest', opts.brandLaneId, {
      ok: false,
      error: msg,
      retryable,
      dryRun,
    });
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
