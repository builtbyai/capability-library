/**
 * tiktok/login.setup.ts — interactive TikTok login session capture.
 *
 * Run this once (or whenever the session expires, ~30 days) via:
 *
 *   npx playwright test --project=setup --grep tiktok
 *
 * The browser opens to tiktok.com/login. The operator logs in MANUALLY
 * (email + password, SMS code, QR code, whatever TikTok requires today).
 * The test waits up to 10 minutes for the URL to settle on a known
 * logged-in surface (`/foryou` or `/<@handle>`), then persists the
 * resulting cookies + localStorage to `playwright/.auth/tiktok.json`.
 *
 * Why "wait for URL change" instead of "wait for a selector":
 *   TikTok's login flow has at least 5 shapes (email, phone, QR, OAuth,
 *   captcha challenge) and the selectors for each drift constantly. The
 *   URL transitions on success are the most stable signal — once the
 *   user lands on a non-login page on tiktok.com they are authenticated.
 */
import { test as setup, expect } from '@playwright/test';
import { saveSession } from '../shared.js';

const LOGIN_URL = 'https://www.tiktok.com/login';

/** Surfaces that TikTok bounces to after a successful login. The first
 *  one we see ends the wait. */
const LOGGED_IN_URL_PATTERNS = [
  /tiktok\.com\/foryou/,
  /tiktok\.com\/following/,
  /tiktok\.com\/@/,
  /tiktok\.com\/?$/, // bare homepage when already logged in
];

setup('tiktok :: capture session', async ({ page, context }) => {
  console.log('\n========================================================');
  console.log(' TikTok login session capture');
  console.log('--------------------------------------------------------');
  console.log(' Please log in MANUALLY in the opened Chromium window.');
  console.log(' Email / phone / QR — whatever works for the account.');
  console.log(' This script will detect success automatically and save');
  console.log(' the session to playwright/.auth/tiktok.json');
  console.log(' Timeout: 10 minutes.');
  console.log('========================================================\n');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  // Wait until the URL settles on a logged-in surface. We poll in a loop
  // so that intermediate redirects (captcha → 2FA → home) don't cause a
  // single waitForURL call to fire prematurely on a transient match.
  const deadline = Date.now() + 10 * 60 * 1000;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const url = page.url();
    if (LOGGED_IN_URL_PATTERNS.some((re) => re.test(url)) && !/\/login/.test(url)) {
      // Settle: wait 2s and re-check so a transient redirect doesn't
      // fool us. If still on a logged-in surface, we're done.
      await page.waitForTimeout(2000);
      const after = page.url();
      if (LOGGED_IN_URL_PATTERNS.some((re) => re.test(after)) && !/\/login/.test(after)) {
        loggedIn = true;
        break;
      }
    }
    await page.waitForTimeout(1500);
  }

  if (!loggedIn) {
    throw new Error(
      'TikTok login was not detected within 10 minutes. ' +
        'Verify the URL transitioned away from /login and rerun the setup.',
    );
  }

  // Sanity probe: TikTok exposes a sessionid / sid_tt cookie when logged in.
  const cookies = await context.cookies('https://www.tiktok.com');
  const hasSessionCookie = cookies.some(
    (c) => c.name === 'sessionid' || c.name === 'sid_tt' || c.name === 'sid_guard',
  );
  expect(hasSessionCookie, 'Expected a TikTok session cookie after login').toBeTruthy();

  const saved = await saveSession('tiktok', context);
  console.log(`[tiktok] session saved → ${saved}`);
});
