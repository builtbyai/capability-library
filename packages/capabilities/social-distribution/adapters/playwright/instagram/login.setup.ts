/**
 * instagram/login.setup.ts — interactive Instagram login session capture.
 *
 * Run:
 *   npx playwright test --project=setup --grep instagram
 *
 * Notes:
 *   - Instagram aggressively detects automation. The setup MUST be done
 *     in HEADED mode (the config enforces this) so the operator can
 *     pass any CAPTCHA / "we noticed a new login" prompt that Instagram
 *     puts in front of the actual login form.
 *   - The "Save info?" and "Turn on notifications?" interstitials that
 *     appear after a successful login are auto-dismissed below — they
 *     do not need to be visible for the session to be valid.
 *   - The script captures the session AFTER the operator lands on the
 *     home feed (`/` or `/feed/...`) so the cookies include the IG
 *     csrftoken and ds_user_id that uploads require.
 */
import { test as setup, expect } from '@playwright/test';
import { saveSession } from '../shared.js';

const LOGIN_URL = 'https://www.instagram.com/accounts/login/';

/** URL patterns that indicate a successful logged-in landing. */
const LOGGED_IN_URL_PATTERNS = [
  /instagram\.com\/?$/,
  /instagram\.com\/feed/,
  /instagram\.com\/[^/]+\/?$/, // own profile redirect
];

setup('instagram :: capture session', async ({ page, context }) => {
  console.log('\n========================================================');
  console.log(' Instagram login session capture');
  console.log('--------------------------------------------------------');
  console.log(' Please log in MANUALLY in the opened Chromium window.');
  console.log(' If Instagram shows a "suspicious login" screen, complete');
  console.log(' the email/SMS code prompt in the same window — this');
  console.log(' script will keep waiting up to 10 minutes.');
  console.log(' Session saves to playwright/.auth/instagram.json');
  console.log('========================================================\n');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const deadline = Date.now() + 10 * 60 * 1000;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const url = page.url();
    // Skip the post-login interstitials by URL — Instagram routes through
    // /accounts/onetap/ and /challenge/ before settling on the feed.
    if (/\/accounts\/(login|onetap|emailsignup)/.test(url) || /\/challenge/.test(url)) {
      await page.waitForTimeout(1500);
      continue;
    }
    if (LOGGED_IN_URL_PATTERNS.some((re) => re.test(url))) {
      // Dismiss the optional "Save Login Info?" and "Turn on Notifications?"
      // dialogs if Instagram pops them up before the user clicks anywhere.
      const notNow = page.locator('button:has-text("Not Now"), button:has-text("Not now")').first();
      if (await notNow.isVisible({ timeout: 1000 }).catch(() => false)) {
        await notNow.click().catch(() => {});
        await page.waitForTimeout(750);
      }
      await page.waitForTimeout(2000);
      loggedIn = true;
      break;
    }
    await page.waitForTimeout(1500);
  }

  if (!loggedIn) {
    throw new Error(
      'Instagram login was not detected within 10 minutes. ' +
        'Re-run after completing any challenge prompts.',
    );
  }

  // Sanity check: IG sets sessionid + ds_user_id on a logged-in session.
  const cookies = await context.cookies('https://www.instagram.com');
  const hasSession = cookies.some((c) => c.name === 'sessionid');
  expect(hasSession, 'Expected an Instagram sessionid cookie').toBeTruthy();

  const saved = await saveSession('instagram', context);
  console.log(`[instagram] session saved → ${saved}`);
});
