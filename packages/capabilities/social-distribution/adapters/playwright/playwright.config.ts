/**
 * playwright.config.ts — adapter test/runtime config.
 *
 * Mirrors the pattern in `C:/Code/playwright-loginsession-global-setup-main`:
 *
 *   1. A `setup` project runs first. It contains the four `*.setup.ts`
 *      scripts (one per platform). Each one opens a real Chromium window,
 *      waits up to 10 minutes for the human operator to complete the
 *      platform's login flow, and persists the resulting cookies +
 *      localStorage into `playwright/.auth/<platform>.json`.
 *
 *   2. Four authenticated projects (`tiktok`, `instagram`, `facebook`,
 *      `pinterest`) declare `dependencies: ['setup']` so they cannot run
 *      until the matching setup has produced a storage-state file. Each
 *      project's `use.storageState` points at its own platform's file —
 *      the IG project is NEVER allowed to run with the TikTok session and
 *      vice versa (the per-project storageState pinning is the static
 *      half of the brand-lane firewall: cookies cannot leak across
 *      platforms at the Playwright layer).
 *
 *   3. The default browser is Chromium with `headless: false` for the
 *      `setup` project (human needs to see the window) and inherits the
 *      `HEADLESS` env var for the platform projects (default headed; CI
 *      sets `HEADLESS=1`). Real Chrome channel is preferred for
 *      production runs because residential anti-bot fingerprinting
 *      flags Chromium-default fingerprints more often than Stable Chrome.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { STORAGE_STATE_DIR } from './shared.js';

const HEADLESS = process.env.HEADLESS === '1';
const CHANNEL = process.env.PW_CHANNEL || undefined; // e.g. 'chrome' for real Chrome
const SETUP_TIMEOUT_MS = Number(process.env.SETUP_TIMEOUT_MS || 10 * 60 * 1000);

const PLATFORMS = ['tiktok', 'instagram', 'facebook', 'pinterest'] as const;

export default defineConfig({
  testDir: '.',
  /** Setup tests are interactive — they hold the browser open while the
   *  operator logs in. Per-test timeout MUST be larger than the human's
   *  realistic login window, including any 2FA / SMS code waits. */
  timeout: SETUP_TIMEOUT_MS,
  expect: { timeout: 30_000 },
  fullyParallel: false, // serial — uploads to a real platform should never race
  forbidOnly: !!process.env.CI,
  retries: 0, // never auto-retry a real publish; a retry could duplicate a post
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    /** Recording knobs — keep them on by default so that when a real
     *  publish fails, the trace + video are immediately available for
     *  triage. The cost is disk; turn them off for high-volume runs. */
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: HEADLESS,
    channel: CHANNEL,
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    /** Real Chrome's UA. Playwright Chromium's default UA includes
     *  "HeadlessChrome" even when headed, which some platforms flag. */
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: '**/*.setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        headless: false, // human must see the login window
        channel: CHANNEL,
      },
    },
    ...PLATFORMS.map((platform) => ({
      name: platform,
      testMatch: `${platform}/**/*.test.ts`,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(STORAGE_STATE_DIR, `${platform}.json`),
        headless: HEADLESS,
        channel: CHANNEL,
      },
    })),
  ],
});
