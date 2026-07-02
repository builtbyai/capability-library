import { describe, it, expect } from 'vitest';

import {
  MarginComputationSchema,
  RedFlagSchema,
  ScoreComputationSchema,
  ScorecardSchema,
  SupplierConfidenceSchema,
  WorkAllowancePolicySchema,
} from '../contracts/index.js';

describe('product-scoring contracts', () => {
  it('ScoreComputationSchema parses a valid 8-category payload', () => {
    const payload = {
      scorecardVersion: 'v1.0.0',
      categories: {
        demandVelocity: 5,
        profitMargin: 4,
        ugcPotential: 3,
        supplierReliability: 4,
        competitionSaturation: 2,
        brandLaneFit: 5,
        problemIntensity: 4,
        complianceReturnRisk: 5,
      },
      totalScore: 82,
      band: 'launch' as const,
      decisionState: 'BUILD' as const,
      marginUsd: 18.5,
      supplierConfidence: 'High' as const,
      redFlags: [],
      computedAt: '2026-06-29T12:00:00.000Z',
      scorer: 'product-scoring@deepseek-v4',
    };
    expect(() => ScoreComputationSchema.parse(payload)).not.toThrow();
  });

  it('ScoreComputationSchema rejects a category value outside 1-5', () => {
    const bad = {
      scorecardVersion: 'v1.0.0',
      categories: {
        demandVelocity: 7, // out of range
        profitMargin: 4,
        ugcPotential: 3,
        supplierReliability: 4,
        competitionSaturation: 2,
        brandLaneFit: 5,
        problemIntensity: 4,
        complianceReturnRisk: 5,
      },
      totalScore: 82,
      band: 'launch',
      decisionState: 'BUILD',
      redFlags: [],
      computedAt: '2026-06-29T12:00:00.000Z',
      scorer: 'product-scoring@deepseek-v4',
    };
    expect(() => ScoreComputationSchema.parse(bad)).toThrow();
  });

  it('MarginComputationSchema parses a valid landed-cost breakdown', () => {
    const margin = {
      landedCostUsd: 7.50,
      sellingPriceUsd: 29.99,
      marginUsd: 22.49,
      marginPct: 0.75,
      computedAt: '2026-06-29T12:00:00.000Z',
      breakdown: { product: 4.00, shipping: 2.00, fees: 1.00, processing: 0.50 },
    };
    expect(() => MarginComputationSchema.parse(margin)).not.toThrow();
  });

  it('MarginComputationSchema rejects negative landedCostUsd', () => {
    const bad = {
      landedCostUsd: -1,
      sellingPriceUsd: 29.99,
      marginUsd: 30.99,
      marginPct: 1.04,
      computedAt: '2026-06-29T12:00:00.000Z',
      breakdown: { product: 0, shipping: 0, fees: 0, processing: 0 },
    };
    expect(() => MarginComputationSchema.parse(bad)).toThrow();
  });

  it('SupplierConfidenceSchema parses a valid confidence row', () => {
    const conf = {
      confidence: 'High' as const,
      score: 0.87,
      signals: [
        { signal: 'sample-path-verified', weight: 0.4, value: true },
        { signal: 'repeat-orders', weight: 0.3, value: 12 },
      ],
      computedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => SupplierConfidenceSchema.parse(conf)).not.toThrow();
  });

  it('SupplierConfidenceSchema rejects an invalid confidence tier', () => {
    const bad = {
      confidence: 'VeryHigh', // not in enum
      score: 0.87,
      signals: [],
      computedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => SupplierConfidenceSchema.parse(bad)).toThrow();
  });

  it('RedFlagSchema parses a blocker flag with evidence', () => {
    const flag = {
      flag: 'fake-scarcity-required-to-sell',
      severity: 'blocker' as const,
      source: 'product-scoring@deepseek-v4',
      raisedAt: '2026-06-29T12:00:00.000Z',
      evidence: { snippet: 'only 3 left in stock', sourceUrl: 'https://example.com' },
    };
    expect(() => RedFlagSchema.parse(flag)).not.toThrow();
  });

  it('RedFlagSchema rejects an invalid severity', () => {
    const bad = {
      flag: 'fake-claim',
      severity: 'critical', // not in enum
      source: 'product-scoring',
      raisedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => RedFlagSchema.parse(bad)).toThrow();
  });

  it('ScorecardSchema parses a valid scorecard with weights + bands', () => {
    const scorecard = {
      scorecardVersion: 'v1.0.0',
      weights: {
        demandVelocity: 2.0,
        profitMargin: 2.0,
        ugcPotential: 1.5,
        supplierReliability: 1.5,
        competitionSaturation: 1.0,
        brandLaneFit: 1.0,
        problemIntensity: 1.5,
        complianceReturnRisk: 1.5,
      },
      decisionBands: { launch: 80, test: 70, watchlist: 60, rejectBelow: 50 },
    };
    expect(() => ScorecardSchema.parse(scorecard)).not.toThrow();
  });

  it('ScorecardSchema rejects a negative weight', () => {
    const bad = {
      scorecardVersion: 'v1.0.0',
      weights: {
        demandVelocity: -1, // negative not allowed
        profitMargin: 2,
        ugcPotential: 1.5,
        supplierReliability: 1.5,
        competitionSaturation: 1,
        brandLaneFit: 1,
        problemIntensity: 1.5,
        complianceReturnRisk: 1.5,
      },
      decisionBands: { launch: 80, test: 70, watchlist: 60, rejectBelow: 50 },
    };
    expect(() => ScorecardSchema.parse(bad)).toThrow();
  });

  it('WorkAllowancePolicySchema parses a valid budget policy', () => {
    const policy = {
      perProduct: { totalHardCap: 25 },
      perBrandLaneDaily: { softCap: 50, hardCap: 100 },
      globalDaily: { softCap: 200, hardCap: 500 },
      approvalRules: {
        overSoftCap: 'operator' as const,
        overHardCap: 'forbidden' as const,
        newConnectorSpend: 'operator' as const,
      },
    };
    expect(() => WorkAllowancePolicySchema.parse(policy)).not.toThrow();
  });

  it('WorkAllowancePolicySchema rejects a negative hardCap', () => {
    const bad = {
      perProduct: { totalHardCap: -5 },
      perBrandLaneDaily: { softCap: 50, hardCap: 100 },
      globalDaily: { softCap: 200, hardCap: 500 },
      approvalRules: { overSoftCap: 'auto', overHardCap: 'forbidden', newConnectorSpend: 'auto' },
    };
    expect(() => WorkAllowancePolicySchema.parse(bad)).toThrow();
  });
});
