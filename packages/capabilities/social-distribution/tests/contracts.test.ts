/**
 * Contract shape tests for social-distribution. These are NOT business-logic
 * tests — they pin the zod schemas so accidental shape drift surfaces in CI
 * before downstream consumers break.
 */
import { describe, it, expect } from 'vitest';

import {
  LaneConnectorBindingSchema,
  LaneViolationSchema,
  PlatformSchema,
  PreflightCheckSchema,
  PreflightResultSchema,
  SocialPostSchema,
} from '../contracts/social.js';

const ts = '2026-06-29T12:00:00.000Z';
const lane = 'lane_outdoors';

function validPreflightResult(): unknown {
  return {
    checkedAt: ts,
    postRef: 'post_abc123',
    checks: [
      { checkName: 'brand-lane-bound', passed: true },
      { checkName: 'content-authenticity-passed', passed: true },
      { checkName: 'funnel-link-healthy', passed: true },
      { checkName: 'tracking-utm-set', passed: true },
      { checkName: 'platform-spec-compliant', passed: true },
      { checkName: 'rate-limit-headroom', passed: true },
      { checkName: 'tos-risk-acceptable', passed: true },
    ],
    decision: 'pass',
  };
}

describe('PlatformSchema', () => {
  it('accepts all 8 supported platforms', () => {
    for (const p of [
      'tiktok',
      'tiktok-shop',
      'instagram-reels',
      'instagram-stories',
      'facebook-feed',
      'pinterest',
      'linkedin',
      'youtube-shorts',
    ]) {
      expect(PlatformSchema.parse(p)).toBe(p);
    }
  });

  it('rejects an unknown platform', () => {
    expect(() => PlatformSchema.parse('threads')).toThrow();
  });
});

describe('PreflightCheckSchema', () => {
  it('accepts a passing check with no severity', () => {
    expect(() => PreflightCheckSchema.parse({ checkName: 'brand-lane-bound', passed: true })).not.toThrow();
  });

  it('accepts a failing check with blocker severity', () => {
    const c = PreflightCheckSchema.parse({
      checkName: 'tos-risk-acceptable',
      passed: false,
      evidence: 'flagged-hashtag #miraclecure',
      blockerSeverity: 'blocker',
    });
    expect(c.blockerSeverity).toBe('blocker');
  });
});

describe('PreflightResultSchema', () => {
  it('accepts a 7-check pass result', () => {
    const parsed = PreflightResultSchema.parse(validPreflightResult());
    expect(parsed.decision).toBe('pass');
    expect(parsed.checks).toHaveLength(7);
  });

  it('accepts a fail result with failedAt naming the first blocker', () => {
    const r = validPreflightResult() as ReturnType<typeof PreflightResultSchema.parse>;
    r.checks[0] = {
      checkName: 'brand-lane-bound',
      passed: false,
      blockerSeverity: 'blocker',
      evidence: 'no binding for lane_outdoors on tiktok',
    };
    r.decision = 'fail';
    r.failedAt = 'brand-lane-bound';
    expect(() => PreflightResultSchema.parse(r)).not.toThrow();
  });

  it('rejects a result with zero checks', () => {
    const r = validPreflightResult() as { checks: unknown[] };
    r.checks = [];
    expect(() => PreflightResultSchema.parse(r)).toThrow();
  });
});

describe('SocialPostSchema', () => {
  it('accepts a queued post with full state', () => {
    const post = {
      postId: 'post_abc123',
      productId: 'prod_aaaaaaaaaaaa',
      brandLane: lane,
      platforms: ['tiktok', 'instagram-reels'],
      status: 'queued',
      conceptRefs: { hookId: 'hook_1', captionId: 'cap_1' },
      mediaRefs: [{ kind: 'video', intakeObjectId: 'intk_1' }],
      trackingLinkId: 'fnl_link_1',
      preflightResult: validPreflightResult(),
      publishedRefs: [],
      createdAt: ts,
      updatedAt: ts,
    };
    expect(() => SocialPostSchema.parse(post)).not.toThrow();
  });

  it('rejects a post with zero media refs', () => {
    const post = {
      postId: 'post_abc123',
      productId: 'prod_aaaaaaaaaaaa',
      brandLane: lane,
      platforms: ['tiktok'],
      status: 'queued',
      conceptRefs: { hookId: 'h1', captionId: 'c1' },
      mediaRefs: [],
      trackingLinkId: 'fnl_link_1',
      preflightResult: validPreflightResult(),
      publishedRefs: [],
      createdAt: ts,
      updatedAt: ts,
    };
    expect(() => SocialPostSchema.parse(post)).toThrow();
  });

  it('rejects an unknown status', () => {
    const post = {
      postId: 'post_abc123',
      productId: 'prod_aaaaaaaaaaaa',
      brandLane: lane,
      platforms: ['tiktok'],
      status: 'in-flight',
      conceptRefs: { hookId: 'h1', captionId: 'c1' },
      mediaRefs: [{ kind: 'image', intakeObjectId: 'intk_1' }],
      trackingLinkId: 'fnl_link_1',
      preflightResult: validPreflightResult(),
      publishedRefs: [],
      createdAt: ts,
      updatedAt: ts,
    };
    expect(() => SocialPostSchema.parse(post)).toThrow();
  });
});

describe('LaneConnectorBindingSchema', () => {
  it('accepts a binding row', () => {
    const binding = LaneConnectorBindingSchema.parse({
      brandLane: lane,
      platform: 'tiktok',
      connectorId: 'cn_tiktok_outdoors',
      audienceTag: 'outdoors-main',
      boundAt: ts,
      boundBy: 'operator',
    });
    expect(binding.audienceTag).toBe('outdoors-main');
  });
});

describe('LaneViolationSchema (non-retryable audit row)', () => {
  it('accepts a violation row with a known reason', () => {
    const v = LaneViolationSchema.parse({
      violationId: 'vio_1',
      attemptedPostId: 'post_abc123',
      brandLane: lane,
      platform: 'tiktok',
      connectorId: 'cn_tiktok_wrong_lane',
      reason: 'connector-not-bound-to-lane',
      detectedAt: ts,
    });
    expect(v.reason).toBe('connector-not-bound-to-lane');
  });

  it('rejects an unknown reason — the closed enum is the firewall contract', () => {
    expect(() =>
      LaneViolationSchema.parse({
        violationId: 'vio_1',
        attemptedPostId: 'post_abc123',
        brandLane: lane,
        platform: 'tiktok',
        connectorId: 'cn_tiktok_wrong_lane',
        reason: 'just-because',
        detectedAt: ts,
      }),
    ).toThrow();
  });
});
