/**
 * facebook/login.setup.ts — interactive Facebook login session capture.
 *
 * Run:
 *   npx playwright test --project=setup --grep facebook
 *
 * Facebook's web login is the most stable of the four — historically
 * fewer mid-stream redirects than IG/TikTok. The only common surprise
 * is the "Save your login info?" prompt that appears after a successful
 * login on a fresh browser. We dismiss it automatically.
 *
 * If the account is a Page admin, the saved session is reusable for
 * BOTH personal feed posts and Page posts (the upload adapter switches
 * personas via Page selector inside the composer).
 */
import { test as setup, expect } from '@playwright/test';
import { saveSession } from '../shared.js';

const LOGIN_URL = 'https://www.facebook.com/login';

const LOGGED_IN_URL_PATTERNS = [
  /facebook\.com\/?$/,
  /facebook\.com\/home/,
  /facebook\.com\/\?[^/]*$/,
];

setup('facebook :: capture session', async ({ page, context }) => {
  console.log('\n========================================================');
  console.log(' Facebook login session capture');
  console.log('--------------------------------------------------------');
  console.log(' Log in MANUALLY in the opened Chromium window.');
  console.log(' Includes any 2FA challenge. Up to 10 minutes.');
  console.log(' Session saves to playwright/.auth/facebook.json');
  console.log('========================================================\n');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const deadline = Date.now() + 10 * 60 * 1000;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const url = page.url();
    if (/\/login|\/checkpoint|\/two_factor/.test(url)) {
      await page.waitForTimeout(1500);
      continue;
    }
    if (LOGGED_IN_URL_PATTERNS.some((re) => re.test(url))) {
      // Dismiss the optional "Save your login info" prompt.
      const notNow = page
        .locator('div[role="button"]:has-text("Not Now"), div[role="button"]:has-text("Not now")')
        .first();
      if (await notNow.isVisible({ timeout: 1000 }).catch(() => false)) {
        await notNow.click().catch(() => {});
      }
      await page.waitForTimeout(2000);
      loggedIn = true;
      break;
    }
    await page.waitForTimeout(1500);
  }

  if (!loggedIn) {
    throw new Error('Facebook login was not detected within 10 minutes.');
  }

  const cookies = await context.cookies('https://www.facebook.com');
  // c_user is the authenticated FB user id; presence == logged in.
  const hasUser = cookies.some((c) => c.name === 'c_user');
  expect(hasUser, 'Expected an FB c_user cookie').toBeTruthy();

  const saved = await saveSession('facebook', context);
  console.log(`[facebook] session saved → ${saved}`);
});
