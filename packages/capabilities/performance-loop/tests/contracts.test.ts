/**
 * Contract shape tests for performance-loop. These pin the zod schemas
 * so accidental shape drift surfaces in CI before downstream consumers
 * break — they're not business-logic tests.
 */
import { describe, it, expect } from 'vitest';

import {
  CommentObjectionCaptureSchema,
  CostPerResultSchema,
  CreativeWinnerSchema,
  DecisionStateChangeSchema,
  FeedbackRoutingSchema,
  PerfMetricSchema,
  PerfSnapshotSchema,
  ReviewPacketSchema,
} from '../contracts/perf.js';

const ts = '2026-06-29T12:00:00.000Z';
const productId = 'prod_aaaaaaaaaaaa';

function validMetrics() {
  return {
    views: 1000,
    watchTime: 1234.5,
    saves: 12,
    shares: 4,
    clicks: 30,
    atc: 6,
    purchases: 2,
    optins: 5,
    returns: 0,
    commentLanguageSamples: 18,
  };
}

describe('PerfMetricSchema', () => {
  it('accepts a 10-field non-negative record', () => {
    expect(() => PerfMetricSchema.parse(validMetrics())).not.toThrow();
  });

  it('rejects a negative metric value', () => {
    const bad = { ...validMetrics(), views: -1 };
    expect(() => PerfMetricSchema.parse(bad)).toThrow();
  });

  it('rejects a missing field — the 10-field shape is fixed', () => {
    const bad = { ...validMetrics() } as Record<string, number>;
    delete bad.commentLanguageSamples;
    expect(() => PerfMetricSchema.parse(bad)).toThrow();
  });
});

describe('PerfSnapshotSchema', () => {
  it('accepts a well-formed snapshot', () => {
    const snap = {
      snapshotId: 'snap_1',
      productId,
      brandLane: 'lane_outdoors',
      platformPostRef: { platform: 'tiktok', platformPostId: 'pp_1' },
      windowStartAt: ts,
      windowEndAt: ts,
      metrics: validMetrics(),
      sourceProvider: 'tiktok-graph-api',
      recordedAt: ts,
    };
    expect(() => PerfSnapshotSchema.parse(snap)).not.toThrow();
  });
});

describe('DecisionStateChangeSchema', () => {
  it('accepts a transition with reason + evidence', () => {
    const change = {
      productId,
      fromState: 'TEST',
      toState: 'SCALE',
      reason: 'auto-rollup',
      evidence: { snapshotIds: ['snap_1', 'snap_2'], scoreEntryIds: [] },
      changedAt: ts,
    };
    expect(() => DecisionStateChangeSchema.parse(change)).not.toThrow();
  });

  it('rejects an unknown reason — the closed enum is the audit contract', () => {
    const change = {
      productId,
      fromState: 'TEST',
      toState: 'KILL',
      reason: 'vibes',
      evidence: { snapshotIds: [], scoreEntryIds: [] },
      changedAt: ts,
    };
    expect(() => DecisionStateChangeSchema.parse(change)).toThrow();
  });

  it('rejects an unknown decisionState target', () => {
    const change = {
      productId,
      fromState: 'TEST',
      toState: 'DEPRECATED',
      reason: 'auto-rollup',
      evidence: { snapshotIds: [], scoreEntryIds: [] },
      changedAt: ts,
    };
    expect(() => DecisionStateChangeSchema.parse(change)).toThrow();
  });
});

describe('CreativeWinnerSchema', () => {
  it('accepts a winner record', () => {
    const winner = {
      winnerId: 'win_1',
      productId,
      testWindow: { startAt: ts, endAt: ts },
      topHook: 'POV: your dog steals',
      topPerformanceMetric: 'watchTime',
      value: 18.3,
      computedAt: ts,
    };
    expect(() => CreativeWinnerSchema.parse(winner)).not.toThrow();
  });
});

describe('FeedbackRoutingSchema', () => {
  it('accepts every routing target in the closed enum', () => {
    for (const target of [
      'product-scoring',
      'ugc-concept-engine',
      'media-generation',
      'funnel-builder',
      'supplier-rescore',
    ]) {
      const routing = {
        routingId: `rt_${target}`,
        productId,
        target,
        payload: { example: true },
        routedAt: ts,
      };
      expect(() => FeedbackRoutingSchema.parse(routing)).not.toThrow();
    }
  });

  it('rejects an unknown routing target', () => {
    const routing = {
      routingId: 'rt_x',
      productId,
      target: 'mystery-cap',
      payload: {},
      routedAt: ts,
    };
    expect(() => FeedbackRoutingSchema.parse(routing)).toThrow();
  });
});

describe('CostPerResultSchema (division-by-zero guard)', () => {
  it('accepts a normal cost-per-result row', () => {
    const row = {
      productId,
      assetIntakeObjectId: 'intk_1',
      period: { startAt: ts, endAt: ts },
      totalCostUsd: 100,
      primaryResultMetric: 'purchase',
      resultCount: 4,
      costPerResult: 25,
      computedAt: ts,
    };
    expect(() => CostPerResultSchema.parse(row)).not.toThrow();
  });

  it('accepts a zero-result row (the persisted costPerResult uses the max(1,...) guard upstream)', () => {
    const row = {
      productId,
      assetIntakeObjectId: 'intk_1',
      period: { startAt: ts, endAt: ts },
      totalCostUsd: 100,
      primaryResultMetric: 'purchase',
      resultCount: 0,
      costPerResult: 100,
      computedAt: ts,
    };
    expect(() => CostPerResultSchema.parse(row)).not.toThrow();
  });

  it('rejects a negative cost or count', () => {
    const row = {
      productId,
      assetIntakeObjectId: 'intk_1',
      period: { startAt: ts, endAt: ts },
      totalCostUsd: -5,
      primaryResultMetric: 'purchase',
      resultCount: 1,
      costPerResult: -5,
      computedAt: ts,
    };
    expect(() => CostPerResultSchema.parse(row)).toThrow();
  });
});

describe('CommentObjectionCaptureSchema', () => {
  it('accepts a capture without classification (classifier lags by design)', () => {
    const cap = {
      captureId: 'cap_1',
      productId,
      platform: 'tiktok',
      platformCommentId: 'pcm_1',
      text: 'does this actually work on suede?',
      capturedAt: ts,
    };
    expect(() => CommentObjectionCaptureSchema.parse(cap)).not.toThrow();
  });

  it('rejects a sentimentScore out of [-1, 1]', () => {
    const cap = {
      captureId: 'cap_1',
      productId,
      platform: 'tiktok',
      platformCommentId: 'pcm_1',
      text: 'fake',
      sentimentScore: -2,
      capturedAt: ts,
    };
    expect(() => CommentObjectionCaptureSchema.parse(cap)).toThrow();
  });
});

describe('ReviewPacketSchema', () => {
  it('accepts a weekly packet with one product highlight', () => {
    const packet = {
      packetId: 'pkt_1',
      period: 'weekly',
      startAt: ts,
      endAt: ts,
      summary: {
        productsTested: 5,
        productsKilled: 1,
        productsScaled: 1,
        totalSpendUsd: 200,
        totalRevenueUsd: 850,
        costPerResultMedian: 18.5,
      },
      perProductHighlights: [
        {
          productId,
          winners: [],
          topObjections: [],
        },
      ],
      generatedAt: ts,
    };
    expect(() => ReviewPacketSchema.parse(packet)).not.toThrow();
  });
});
