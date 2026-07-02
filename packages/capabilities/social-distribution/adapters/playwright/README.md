# `@multimarcdown/social-distribution-playwright`

Playwright-driven social distribution adapters for **TikTok, Instagram, Facebook, Pinterest**. Each platform exposes a single `postVideo()` / `postImage()` / `postPost()` / `postPin()` entry point the MJB `social-distribution` capability calls after media is generated.

> **One-time interactive login per platform.** The session is persisted to disk as `playwright/.auth/<platform>.json`. Subsequent publishes reuse the cookies — no credentials live in the codebase, no browser opens by default.

---

## File layout

```
adapters/playwright/
  package.json
  playwright.config.ts
  tsconfig.json
  shared.ts                 — common types, session paths, brand-lane firewall
  index.ts                  — barrel + postToPlatform() dispatcher
  .gitignore                — excludes playwright/.auth/** SECRETS
  playwright/.auth/         — runtime storage-state (gitignored)
  tiktok/
    login.setup.ts          — interactive session capture
    upload.ts               — postVideo()
    upload.test.ts          — @dry smoke
  instagram/
    login.setup.ts
    upload.ts               — postVideo() + postImage()
    upload.test.ts
  facebook/
    login.setup.ts
    upload.ts               — postPost()  (feed or Page)
    upload.test.ts
  pinterest/
    login.setup.ts
    upload.ts               — postPin()
    upload.test.ts
```

---

## First-time setup (per platform)

```bash
cd packages/capabilities/social-distribution/adapters/playwright

# 1. Install once at the workspace root — the adapter declares playwright
#    as a dep but does NOT auto-install it. Run from the repo root:
#    npm install --workspace=@multimarcdown/social-distribution-playwright

# 2. Capture a session for each platform you intend to publish to.
#    Each command opens a headed Chromium window — log in MANUALLY,
#    finish any 2FA / captcha, and the script auto-detects success.
npx playwright test --project=setup --grep tiktok
npx playwright test --project=setup --grep instagram
npx playwright test --project=setup --grep facebook
npx playwright test --project=setup --grep pinterest

# Or capture all four in sequence (the config forces serial workers):
npx playwright test --project=setup
```

Each setup persists `playwright/.auth/<platform>.json`. The directory is gitignored — it is a SECRET on par with a long-lived bearer token.

---

## Subsequent posts (from any node script)

```ts
import {
  postToPlatform,
  postVideoTikTok,
  postFacebook,
  postPinterest,
} from '@multimarcdown/social-distribution-playwright';

// Option A — unified dispatcher (used by the MJB publish job):
const r1 = await postToPlatform('tiktok', {
  videoPath: '/abs/path/to/render.mp4',
  caption: 'Pegboard tool wall — under $40',
  hashtags: ['homehacks', 'organize', 'mjb'],
  brandLaneId: 'mjb-home-finds',
});
// r1 → { ok: true, platformPostId: '737...', postUrl: 'https://www.tiktok.com/@user/video/737...', platform: 'tiktok', brandLaneId: 'mjb-home-finds', dryRun: false }

// Option B — per-platform direct call (for tests / one-offs):
const r2 = await postFacebook({
  imagePath: '/abs/path/to/hero.jpg',
  caption: 'New find — link in the post',
  hashtags: ['mjbtech'],
  brandLaneId: 'mjb-tech-finds',
  platformOptions: { targetPageId: '101234567890123' },
});

// Pinterest needs a board:
const r3 = await postPinterest({
  imagePath: '/abs/path/to/pin.jpg',
  caption: 'Quiet, cheap, easy-to-install — full guide on the site.',
  hashtags: ['homefinds'],
  brandLaneId: 'mjb-home-finds',
  platformOptions: {
    boardId: 'Home Finds',
    destinationUrl: 'https://mjb.example/link/abc',
    title: 'The drawer organizer that fixed our junk drawer',
    altText: 'Beech wood drawer organizer with five removable trays.',
  },
});
```

### Dry-run mode

Every adapter respects `opts.dryRun === true`:

```ts
const probe = await postToPlatform('tiktok', { ...opts, dryRun: true });
// Walks the entire UI flow — attaches file, fills caption, waits for the
// Post button to enable — then logs "DRY RUN — would click Post now."
// Returns { ok: true, dryRun: true } without producing a real post.
```

This is what the `@dry`-tagged `upload.test.ts` files exercise.

---

## Session refresh policy

| Platform  | Typical session lifetime | Detect-and-throw behaviour                                                  |
|-----------|--------------------------|-----------------------------------------------------------------------------|
| TikTok    | ~30 days (active use)    | `Error: TikTok session expired. Re-run: npx playwright test --project=setup --grep tiktok` |
| Instagram | ~60 days (Pro acct)      | `Error: Instagram session expired. Re-run: ... --grep instagram`            |
| Facebook  | ~90 days                 | `Error: Facebook session expired. Re-run: ... --grep facebook`              |
| Pinterest | ~30 days (inactive)      | `Error: Pinterest session expired. Re-run: ... --grep pinterest`            |

Each adapter probes for a known logged-in surface (composer card, Create button, etc.) immediately after the saved-session page load. If the probe fails, it throws with the exact re-setup command — wire that string into your alerting so the operator can re-auth without grepping the codebase.

---

## Brand-lane firewall (MJB primitives 79-80)

Every adapter calls `assertLaneBound(brandLaneId, platform)` BEFORE the browser opens. The check:

1. Loads `config/mjb/brand-lanes.json` (or the path in `MM_BRAND_LANES_PATH`).
2. Finds the lane with `laneId === brandLaneId`.
3. Verifies `lane.connectorAccounts[platform]` is a non-null string.

If any check fails, the adapter returns `{ ok: false, retryable: false, error: '[brand-lane-firewall] ...' }` **synchronously**. The publish job interprets `retryable: false` as a stop-the-line — the post is NOT auto-retried; the operator must either bind a connector, re-assign the product's lane, or cancel the post. This is the **no audience bleed across brands** guarantee.

In particular: the Instagram adapter does NOT toggle the "Also share to Facebook" cross-post box, because that route would bypass the firewall for FB.

---

## Anti-bot tips

The default config is tuned for low-volume, human-supervised publishing. For higher volume:

- **Use real Chrome, not Chromium.** Set `PW_CHANNEL=chrome`. Stable Chrome's fingerprint matches the residential UA in `playwright.config.ts`; Chromium's default fingerprint is more often flagged.
- **Stay headed for the first 5–10 runs per session.** Set `HEADLESS=1` only after you've confirmed the saved session is stable.
- **Human typing delays** are already applied via `humanType()` (35–95ms per character, with jitter). Override with `MM_TYPE_MIN_MS` / `MM_TYPE_MAX_MS` if you need to slow it further.
- **Residential proxy** — for sustained high-volume publishing across many lanes you'll want each lane's posts routed through a stable residential IP. This adapter intentionally does NOT do that; wire your proxy at the `chromium.launch({ proxy: { server, username, password } })` level if needed. Out of scope for the in-repo build.
- **Captcha handling** — none of the four adapters solve CAPTCHAs. If a publish dies with a captcha screen, the trace + video (retained on failure by the config) will show it; the operator must re-run the affected setup interactively.

---

## Environment variables

| Var                       | Default                                                          | Notes                                                          |
|---------------------------|------------------------------------------------------------------|----------------------------------------------------------------|
| `MM_PW_STORAGE_DIR`       | `<adapter>/playwright/.auth`                                     | Where session files live. Override for CI sharding.            |
| `MM_BRAND_LANES_PATH`     | `<repo>/config/mjb/brand-lanes.json`                             | Brand-lane config. Override for non-MJB consumers.             |
| `HEADLESS`                | unset                                                            | Set `=1` to run platform projects headless. `setup` always headed. |
| `PW_CHANNEL`              | unset                                                            | Set `=chrome` to use real Chrome instead of bundled Chromium.  |
| `SETUP_TIMEOUT_MS`        | 600000 (10 min)                                                  | Override the interactive login wait.                           |
| `MM_TT_FIXTURE`           | `./fixtures/sample.mp4`                                          | TikTok dry-run fixture path.                                   |
| `MM_IG_FIXTURE`           | `./fixtures/sample-reel.mp4`                                     | Instagram dry-run fixture path.                                |
| `MM_FB_FIXTURE`           | `./fixtures/sample.mp4`                                          | Facebook dry-run fixture path.                                 |
| `MM_PIN_FIXTURE`          | `./fixtures/sample.jpg`                                          | Pinterest dry-run fixture path.                                |
| `MM_TT_LANE` / `_IG_` / `_FB_` / `_PIN_LANE` | `mjb-home-finds`                                | Brand-lane used in dry-run tests.                              |

---

## Selector volatility — what's most likely to drift

Every adapter has `// TODO: re-verify selector` comments at exactly the points where the platform tends to change copy / `aria-label` / `data-test-id`. The highest-risk spots:

- **TikTok upload Post button** — rotates between `data-e2e="post_video_button"`, plain text `Post`, and `data-tt="upload_post"`. The adapter ORs all three; expect to add a fourth periodically.
- **TikTok caption contenteditable** — has been `div[contenteditable="true"]`, `div[data-e2e="caption-input"]`, `div[role="combobox"]`. The adapter ORs all three.
- **Instagram Create dialog** — IG sometimes labels it `New post`, sometimes `Create`, sometimes only an SVG icon. The adapter probes both text and `aria-label`.
- **Instagram wizard step count** — currently 3 steps (Crop → Edit → Share); has historically been 2 (Edit → Share) and 4 (Aspect → Crop → Edit → Share). The adapter clicks `Next` twice; revisit if a future rollout adds/removes a step.
- **Facebook Photo/Video button** — has been `Photo/video`, `Photo/video, GIF`, `Add Photo/Video`. Matched via `[aria-label*="Photo"]`.
- **Facebook Post button** — `Post` vs `Publish` vs `Share Now` depending on personal-feed vs Page composer. ORed.
- **Pinterest board dropdown** — fully custom-rendered. The picker has been `data-test-id="board-dropdown-select-button"` for a while but the search-input inside it has churned.

When a selector breaks, the resulting `Error: Timeout 30000ms exceeded waiting for locator(...)` lands in the publish job's failure log AND the Playwright trace is retained — open `playwright-report/` and replay the failed test to find the new selector.

---

## TODO

- **Real-account testing.** Every adapter has only been smoke-tested in dry-run. The first wet run against each platform should be supervised, with the trace recorder ON, and ideally on a throwaway account before the production lane connector.
- **Residential proxy integration.** Wire `chromium.launch({ proxy: ... })` from a connector-config secret, per brand-lane.
- **CAPTCHA handling.** Currently if a platform interrupts with a CAPTCHA the publish dies. Detect-and-pause (open the trace's last screenshot, send to operator via the `notify` capability, allow manual resume) is a future enhancement.
- **Post-id resolution for IG and FB.** Both platforms return null `postId` on success because the web flow doesn't surface the new permalink immediately. Follow-up: a `resolvePostId(platform, expectedCaption, since)` helper that hits the user's profile and picks the newest matching post.
- **TikTok Shop, Instagram Stories, LinkedIn, YouTube Shorts.** The parent capability lists 8 platforms; this adapter set covers 4. Mirror this directory structure to add the rest.
- **Native scheduling.** FB and Pinterest support scheduling from the same composer; wiring `scheduledFor` into the date-picker is a separate change.
- **Brand-lane firewall — runtime cookie cross-check.** Currently the firewall checks the config file only. A defence-in-depth pass would also assert that the saved session's `displayName` matches `lane.connectorAccounts[<platform>]` before posting — catches the "operator re-bound the lane but forgot to re-capture the session" footgun.
