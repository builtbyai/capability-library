/**
 * pinterest/login.setup.ts — interactive Pinterest login capture.
 *
 * Run:
 *   npx playwright test --project=setup --grep pinterest
 *
 * Pinterest's login is the simplest of the four — email + password +
 * occasional "Confirm it's you" SMS prompt. The session is durable
 * (~30 days for inactive accounts, longer when in active use).
 */
import { test as setup, expect } from '@playwright/test';
import { saveSession } from '../shared.js';

const LOGIN_URL = 'https://www.pinterest.com/login/';

const LOGGED_IN_URL_PATTERNS = [
  /pinterest\.com\/?$/,
  /pinterest\.com\/[^/]+\/_saved/,
  /pinterest\.com\/business/,
];

setup('pinterest :: capture session', async ({ page, context }) => {
  console.log('\n========================================================');
  console.log(' Pinterest login session capture');
  console.log('--------------------------------------------------------');
  console.log(' Log in MANUALLY in the opened Chromium window.');
  console.log(' Up to 10 minutes. Session saves to playwright/.auth/pinterest.json');
  console.log('========================================================\n');

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  const deadline = Date.now() + 10 * 60 * 1000;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const url = page.url();
    if (/\/login/.test(url)) {
      await page.waitForTimeout(1500);
      continue;
    }
    if (LOGGED_IN_URL_PATTERNS.some((re) => re.test(url))) {
      await page.waitForTimeout(2000);
      loggedIn = true;
      break;
    }
    await page.waitForTimeout(1500);
  }

  if (!loggedIn) {
    throw new Error('Pinterest login was not detected within 10 minutes.');
  }

  const cookies = await context.cookies('https://www.pinterest.com');
  const hasAuth = cookies.some((c) => c.name === '_auth' || c.name === '_pinterest_sess');
  expect(hasAuth, 'Expected a Pinterest auth cookie').toBeTruthy();

  const saved = await saveSession('pinterest', context);
  console.log(`[pinterest] session saved → ${saved}`);
});
