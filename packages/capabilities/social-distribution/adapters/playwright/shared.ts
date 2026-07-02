/**
 * shared.ts — adapter-wide types, paths, and brand-lane firewall.
 *
 * Every per-platform adapter (tiktok/instagram/facebook/pinterest) imports
 * from this file ONLY. Common contract changes happen here; the per-
 * platform `upload.ts` files stay focused on selectors + UI flow.
 *
 * Three responsibilities:
 *
 *   1. Resolve the on-disk storage-state location. The default lives at
 *      `<adapter>/playwright/.auth/<platform>.json` so it sits next to
 *      this file and is covered by the sibling `.gitignore`.
 *
 *   2. Provide a uniform `PostResult` and `PostOptions` shape so the
 *      caller (the MJB social-distribution capability's publish job)
 *      can dispatch to any platform with the same call signature.
 *
 *   3. Enforce the brand-lane firewall (MJB primitives 79-80) by
 *      cross-checking `opts.brandLaneId` against the lane's bound
 *      `connectorAccounts[<platform>]` in `config/mjb/brand-lanes.json`
 *      BEFORE any browser is opened. A mismatch throws synchronously —
 *      the adapter MUST NOT silently fall back to a different account.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolves to `<adapter>/playwright/.auth`. Override with
 *  `MM_PW_STORAGE_DIR` for ephemeral CI shards or per-operator sandboxes. */
export const STORAGE_STATE_DIR =
  process.env.MM_PW_STORAGE_DIR ?? path.join(__dirname, 'playwright', '.auth');

/** Path to the repo's brand-lane config. The adapter walks up two levels
 *  out of the capability tree to find `config/mjb/brand-lanes.json`. The
 *  env var override exists so a non-MJB consumer can point this at any
 *  JSON file with the same `lanes[].connectorAccounts.<platform>` shape. */
export const BRAND_LANES_PATH =
  process.env.MM_BRAND_LANES_PATH ??
  path.resolve(__dirname, '..', '..', '..', '..', '..', 'config', 'mjb', 'brand-lanes.json');

/** The four platforms this adapter set covers. Kept narrow on purpose:
 *  the parent `social-distribution` capability lists 8 platforms; the
 *  other 4 (tiktok-shop, instagram-stories, linkedin, youtube-shorts)
 *  have intentionally different connector shapes and live in their own
 *  adapters when added. */
export type PlatformId = 'tiktok' | 'instagram' | 'facebook' | 'pinterest';

/** Shared input for every per-platform `postVideo` / `postImage` entry. */
export interface PostOptions {
  /** Absolute path to the video file. Required for `postVideo`. */
  videoPath?: string;
  /** Absolute path to the image file. Required for `postImage`. */
  imagePath?: string;
  /** Pre-rendered caption text. The adapter does NOT modify it — escaping
   *  / hashtag interleaving / link-attach are the caller's job (those
   *  are upstream `ugc-concept-engine` / `funnel-builder` concerns). */
  caption: string;
  /** Hashtags WITHOUT the leading `#`. The adapter prefixes per-platform
   *  to keep storage clean. */
  hashtags: string[];
  /** Optional ISO timestamp. If the platform supports native scheduling
   *  (Facebook, Pinterest) the adapter uses it; otherwise the caller
   *  should schedule via its own queue and pass it through unchanged
   *  for logging. */
  scheduledFor?: string;
  /** Required. The brand-lane this post is for. The adapter cross-checks
   *  this against the bound connector account on disk and refuses to
   *  post if mismatched. This is the MJB brand-lane firewall. */
  brandLaneId: string;
  /** When `true`, the adapter walks the whole UI flow up to (but NOT
   *  including) the final Post / Publish click. Use this for CI smoke
   *  tests and for any test that runs against a real account but must
   *  not produce a real post. */
  dryRun?: boolean;
  /** Platform-specific bag. Per-platform options live here so the
   *  common surface stays narrow; e.g. Facebook may need `targetPageId`,
   *  Pinterest needs `boardId`. */
  platformOptions?: Record<string, unknown>;
}

/** Uniform return shape across all four adapters. Shape aligns with the
 *  `SocialPublishedRefSchema` in the parent capability's contracts so
 *  the publish job can fold the result directly into the parent
 *  `SocialPost.publishedRefs` array. */
export interface PostResult {
  ok: boolean;
  /** Set on success. Best-effort: extracted from the post URL or DOM
   *  after the platform confirms publish. Undefined when `dryRun=true`. */
  platformPostId?: string;
  /** Canonical URL of the published surface. Undefined when `dryRun=true`. */
  postUrl?: string;
  /** Human-readable error on `ok=false`. Operator-facing — include enough
   *  context to action it without re-opening the browser. */
  error?: string;
  /** `true` when the error class is transient (network blip, rate-limit,
   *  intermittent selector miss). The retry-failed job uses this to
   *  decide between immediate retry and "stop the line" alerting. */
  retryable?: boolean;
  /** Always present. Echoes back the dry-run flag so the publish job
   *  can verify it didn't accidentally invert it. */
  dryRun: boolean;
  /** Platform that produced the result. */
  platform: PlatformId;
  /** Echoed back for trace correlation. */
  brandLaneId: string;
}

/** Returned by `loadSession` when the storage state for a platform does
 *  not yet exist. The adapter throws with this error message to make the
 *  operator action obvious. */
export const SESSION_MISSING_HINT = (platform: PlatformId) =>
  `[social-distribution-playwright] No saved session for "${platform}". ` +
  `Run: npx playwright test --project=setup --grep ${platform}\n` +
  `This opens a Chromium window — log in manually, then the session is reused.`;

/** Read the path of a platform's storage-state file. Existence is checked
 *  by the caller (Playwright validates it when wiring `use.storageState`). */
export function sessionPath(platform: PlatformId): string {
  return path.join(STORAGE_STATE_DIR, `${platform}.json`);
}

/** Returns true if the storage-state file exists and is JSON-parseable.
 *  This is a cheap pre-flight — the actual logged-in check happens after
 *  the page loads (each adapter has a `isLoggedIn(page)` helper). */
export async function loadSession(platform: PlatformId): Promise<string> {
  const p = sessionPath(platform);
  try {
    const raw = await fs.readFile(p, 'utf8');
    JSON.parse(raw);
    return p;
  } catch {
    throw new Error(SESSION_MISSING_HINT(platform));
  }
}

/** Persist a Playwright `BrowserContext`'s state to disk under the
 *  platform's well-known path. Called by every `*.setup.ts`. */
export async function saveSession(platform: PlatformId, context: BrowserContext): Promise<string> {
  const p = sessionPath(platform);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await context.storageState({ path: p });
  return p;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Brand-lane firewall (MJB primitives 79-80)
 * ──────────────────────────────────────────────────────────────────────── */

interface BrandLaneRecord {
  laneId: string;
  displayName: string;
  connectorAccounts: Record<string, string | null>;
}
interface BrandLanesFile {
  version?: string;
  lanes: BrandLaneRecord[];
}

let _laneCache: { mtimeMs: number; data: BrandLanesFile } | null = null;

/** Cached, mtime-invalidated read of the brand-lanes file. Cheap enough
 *  to call on every adapter dispatch — the file is tiny and the cache
 *  re-loads only when the operator edits the lanes JSON. */
async function loadBrandLanes(): Promise<BrandLanesFile> {
  const stat = await fs.stat(BRAND_LANES_PATH).catch(() => null);
  if (!stat) {
    throw new Error(
      `[social-distribution-playwright] brand-lanes.json not found at ${BRAND_LANES_PATH}. ` +
        `Set MM_BRAND_LANES_PATH to override.`,
    );
  }
  if (_laneCache && _laneCache.mtimeMs === stat.mtimeMs) return _laneCache.data;
  const raw = await fs.readFile(BRAND_LANES_PATH, 'utf8');
  const data = JSON.parse(raw) as BrandLanesFile;
  _laneCache = { mtimeMs: stat.mtimeMs, data };
  return data;
}

/** Throws if `brandLaneId` is not bound to a connector for `platform`.
 *  Returns the bound connector account identifier (whatever string is in
 *  `connectorAccounts[<platform>]`) for logging.
 *
 *  Used at the TOP of every `postVideo`/`postImage`. Synchronous failure
 *  here is the explicit goal — we want the brand-lane firewall to fire
 *  BEFORE the browser opens, before any cookie is read from disk. */
export async function assertLaneBound(
  brandLaneId: string,
  platform: PlatformId,
): Promise<string> {
  const file = await loadBrandLanes();
  const lane = file.lanes.find((l) => l.laneId === brandLaneId);
  if (!lane) {
    throw new Error(
      `[brand-lane-firewall] Unknown brandLaneId="${brandLaneId}". ` +
        `Known lanes: ${file.lanes.map((l) => l.laneId).join(', ')}.`,
    );
  }
  const connectorAccount = lane.connectorAccounts?.[platform];
  if (!connectorAccount) {
    throw new Error(
      `[brand-lane-firewall] Lane "${brandLaneId}" has no connector account bound for ` +
        `platform "${platform}". Bind one in config/mjb/brand-lanes.json before publishing. ` +
        `(MJB primitives 79-80: refusing to publish to prevent audience-bleed across brands.)`,
    );
  }
  return connectorAccount;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Human-input simulation
 * ──────────────────────────────────────────────────────────────────────── */

/** Type text into a focused element with per-character jitter. Slows
 *  the post enough that simple "input event rate" heuristics on the
 *  platform side don't trigger a CAPTCHA. NOT a defence against modern
 *  behavioural fingerprinting (mouse, scroll, focus pattern) — that's
 *  out of scope for this adapter. */
export async function humanType(
  locator: import('playwright').Locator,
  text: string,
  opts: { minMs?: number; maxMs?: number } = {},
): Promise<void> {
  const min = opts.minMs ?? 35;
  const max = opts.maxMs ?? 95;
  await locator.click();
  for (const ch of text) {
    await locator.type(ch, { delay: 0 });
    const wait = Math.floor(min + Math.random() * (max - min));
    await new Promise((r) => setTimeout(r, wait));
  }
}

/** Sleep with mild jitter. Used between UI steps so the script doesn't
 *  click through the upload wizard at impossibly-fast machine speed. */
export async function jitterPause(baseMs = 750, spreadMs = 500): Promise<void> {
  const wait = Math.floor(baseMs + Math.random() * spreadMs);
  await new Promise((r) => setTimeout(r, wait));
}

/** Helper used by every adapter to build the result envelope. Keeps the
 *  per-platform code free of result-shape boilerplate. */
export function makeResult(
  platform: PlatformId,
  brandLaneId: string,
  partial: Omit<PostResult, 'platform' | 'brandLaneId' | 'dryRun'> & { dryRun: boolean },
): PostResult {
  return { platform, brandLaneId, ...partial };
}
