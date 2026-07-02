import { describe, it, expect } from 'vitest';

import {
  AuthenticityCheckSchema,
  ConceptSchema,
  HookFamilySchema,
  ObjectionSchema,
  StoryboardSchema,
} from '../contracts/index.js';

describe('ugc-concept-engine contracts', () => {
  it('HookFamilySchema accepts the six canonical families and rejects others', () => {
    for (const family of [
      'problem-reveal',
      'discovery',
      'comparison',
      'before-after',
      'routine-upgrade',
      'gift',
    ] as const) {
      expect(() => HookFamilySchema.parse(family)).not.toThrow();
    }
    expect(() => HookFamilySchema.parse('viral-trend')).toThrow();
  });

  it('ConceptSchema parses a passed hook concept with all required provenance', () => {
    const concept = {
      conceptId: '550e8400-e29b-41d4-a716-446655440000',
      productId: 'prod_abc123def456',
      kind: 'hook' as const,
      hookFamily: 'problem-reveal' as const,
      content: 'Your dishes still smell after washing? Here\'s why.',
      namedFormat: 'wish-i-found-this-sooner' as const,
      brandLane: 'lane_home_kitchen',
      generatedAt: '2026-06-29T12:00:00.000Z',
      model: 'deepseek-v4',
      costRecordedRef: 'cost_xyz789',
      authenticityPassed: true,
    };
    expect(() => ConceptSchema.parse(concept)).not.toThrow();
  });

  it('ConceptSchema rejects an empty content string', () => {
    const bad = {
      conceptId: '550e8400-e29b-41d4-a716-446655440000',
      productId: 'prod_abc123def456',
      kind: 'caption' as const,
      content: '',
      brandLane: 'lane_home_kitchen',
      generatedAt: '2026-06-29T12:00:00.000Z',
      model: 'deepseek-v4',
      authenticityPassed: true,
    };
    expect(() => ConceptSchema.parse(bad)).toThrow();
  });

  it('ObjectionSchema parses a valid objection-rebuttal pair with intensity in [0,1]', () => {
    const obj = {
      objectionId: '550e8400-e29b-41d4-a716-446655440001',
      productId: 'prod_abc123def456',
      objection: 'Is this safe for stainless steel?',
      rebuttal: 'Yes — it\'s pH-neutral and tested on every cookware surface.',
      intensity: 0.65,
      brandLane: 'lane_home_kitchen',
      generatedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => ObjectionSchema.parse(obj)).not.toThrow();
  });

  it('ObjectionSchema rejects intensity > 1', () => {
    const bad = {
      objectionId: '550e8400-e29b-41d4-a716-446655440001',
      productId: 'prod_abc123def456',
      objection: 'Will it scratch?',
      rebuttal: 'No.',
      intensity: 1.5,
      brandLane: 'lane_home_kitchen',
      generatedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => ObjectionSchema.parse(bad)).toThrow();
  });

  it('StoryboardSchema parses a 3-shot storyboard with summed duration', () => {
    const board = {
      storyboardId: '550e8400-e29b-41d4-a716-446655440002',
      productId: 'prod_abc123def456',
      scriptId: '550e8400-e29b-41d4-a716-446655440099',
      shots: [
        {
          shotNo: 1,
          durationSec: 3,
          visualDescription: 'Close-up of the problem (sticky pan).',
          audioDirection: 'No voiceover; sigh sound effect.',
          onScreenText: 'Still scrubbing?',
        },
        {
          shotNo: 2,
          durationSec: 5,
          visualDescription: 'Hand reaches for product; pours one capful.',
          audioDirection: 'VO: "30 seconds. That\'s it."',
        },
        {
          shotNo: 3,
          durationSec: 4,
          visualDescription: 'Pan wiped clean; reveal hero shot.',
          audioDirection: 'VO: "Link in bio."',
          onScreenText: 'Link in bio',
        },
      ],
      totalDurationSec: 12,
    };
    expect(() => StoryboardSchema.parse(board)).not.toThrow();
  });

  it('AuthenticityCheckSchema accepts a passing check (all clean + lane fit)', () => {
    const pass = {
      checkId: '550e8400-e29b-41d4-a716-446655440003',
      conceptRef: '550e8400-e29b-41d4-a716-446655440000',
      brandLane: 'lane_home_kitchen',
      questions: {
        q1FakeTestimonial: false,
        q2FakePersonalUse: false,
        q3MedicalSafetyFinancialClaim: false,
        q4UnverifiableSpecificity: false,
        q5BrandLaneFit: true,
      },
      decision: 'pass' as const,
      reasons: ['Concept is grounded, on-lane, and makes no fabricated claims.'],
      checkedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => AuthenticityCheckSchema.parse(pass)).not.toThrow();
  });

  it('AuthenticityCheckSchema accepts a reject decision carrying multiple reasons', () => {
    const reject = {
      checkId: '550e8400-e29b-41d4-a716-446655440004',
      conceptRef: '550e8400-e29b-41d4-a716-446655440000',
      brandLane: 'lane_home_kitchen',
      questions: {
        q1FakeTestimonial: true,
        q2FakePersonalUse: false,
        q3MedicalSafetyFinancialClaim: false,
        q4UnverifiableSpecificity: true,
        q5BrandLaneFit: true,
      },
      decision: 'reject' as const,
      reasons: [
        'Q1: cites "Sarah from Texas" as a testimonial without a real source.',
        'Q4: claims "9 out of 10 chefs" with no citation.',
      ],
      checkedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => AuthenticityCheckSchema.parse(reject)).not.toThrow();
  });

  it('AuthenticityCheckSchema rejects an invalid decision value', () => {
    const bad = {
      checkId: '550e8400-e29b-41d4-a716-446655440005',
      conceptRef: '550e8400-e29b-41d4-a716-446655440000',
      brandLane: 'lane_home_kitchen',
      questions: {
        q1FakeTestimonial: false,
        q2FakePersonalUse: false,
        q3MedicalSafetyFinancialClaim: false,
        q4UnverifiableSpecificity: false,
        q5BrandLaneFit: true,
      },
      decision: 'maybe',
      reasons: [],
      checkedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => AuthenticityCheckSchema.parse(bad)).toThrow();
  });
});
