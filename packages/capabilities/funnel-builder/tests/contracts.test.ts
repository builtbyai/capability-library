import { describe, it, expect } from 'vitest';

import {
  FunnelPageSchema,
  LinkHealthSchema,
  OptinCaptureSchema,
  TemplateSchema,
  TrackingLinkSchema,
} from '../contracts/index.js';

describe('funnel-builder contracts', () => {
  it('TemplateSchema parses a registered landing template with field bindings', () => {
    const tpl = {
      templateId: '550e8400-e29b-41d4-a716-446655440010',
      name: 'Home Kitchen Landing v1',
      kind: 'landing' as const,
      brandLane: 'lane_home_kitchen',
      version: 'v1.0.0',
      htmlSkeleton: '<html><body><h1>{{productName}}</h1><p>{{tagline}}</p><a href="{{ctaLink}}">{{ctaLabel}}</a></body></html>',
      fieldBindings: {
        productName: 'name',
        tagline: 'tagline',
        ctaLink: 'metadata.ctaLink',
        ctaLabel: 'metadata.ctaLabel',
      },
      createdAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => TemplateSchema.parse(tpl)).not.toThrow();
  });

  it('TemplateSchema rejects an unknown template kind', () => {
    const bad = {
      templateId: '550e8400-e29b-41d4-a716-446655440010',
      name: 'Custom Carousel',
      kind: 'carousel', // not in TemplateKindSchema enum
      brandLane: 'lane_home_kitchen',
      version: 'v1.0.0',
      htmlSkeleton: '<div></div>',
      fieldBindings: {},
      createdAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => TemplateSchema.parse(bad)).toThrow();
  });

  it('FunnelPageSchema state machine: draft (no publishedUrl yet) is valid', () => {
    const draft = {
      pageId: '550e8400-e29b-41d4-a716-446655440011',
      productId: 'prod_abc123def456',
      templateId: '550e8400-e29b-41d4-a716-446655440010',
      brandLane: 'lane_home_kitchen',
      status: 'draft' as const,
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => FunnelPageSchema.parse(draft)).not.toThrow();
  });

  it('FunnelPageSchema state machine: published has publishedUrl + deploymentId + publishedAt', () => {
    const published = {
      pageId: '550e8400-e29b-41d4-a716-446655440011',
      productId: 'prod_abc123def456',
      templateId: '550e8400-e29b-41d4-a716-446655440010',
      brandLane: 'lane_home_kitchen',
      status: 'published' as const,
      publishedUrl: 'https://kitchen.example.com/p/abc123',
      deploymentId: 'cf_deploy_xyz789',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:05:00.000Z',
      publishedAt: '2026-06-29T12:05:00.000Z',
    };
    expect(() => FunnelPageSchema.parse(published)).not.toThrow();
  });

  it('FunnelPageSchema rejects a non-URL publishedUrl string', () => {
    const bad = {
      pageId: '550e8400-e29b-41d4-a716-446655440011',
      productId: 'prod_abc123def456',
      templateId: '550e8400-e29b-41d4-a716-446655440010',
      brandLane: 'lane_home_kitchen',
      status: 'published',
      publishedUrl: 'not-a-url',
      deploymentId: 'cf_deploy_xyz789',
      createdAt: '2026-06-29T12:00:00.000Z',
      updatedAt: '2026-06-29T12:05:00.000Z',
      publishedAt: '2026-06-29T12:05:00.000Z',
    };
    expect(() => FunnelPageSchema.parse(bad)).toThrow();
  });

  it('TrackingLinkSchema parses a fully-populated tracking link with conceptId in content', () => {
    const link = {
      linkId: '550e8400-e29b-41d4-a716-446655440012',
      shortCode: 'k7hX9p',
      pageId: '550e8400-e29b-41d4-a716-446655440011',
      productId: 'prod_abc123def456',
      brandLane: 'lane_home_kitchen',
      destinationUrl: 'https://kitchen.example.com/p/abc123',
      utm: {
        source: 'tiktok',
        medium: 'organic',
        campaign: 'lane_home_kitchen__prod_abc123def456',
        content: '550e8400-e29b-41d4-a716-446655440000',
      },
      mintedAt: '2026-06-29T12:00:00.000Z',
      hits: 0,
    };
    expect(() => TrackingLinkSchema.parse(link)).not.toThrow();
  });

  it('OptinCaptureSchema requires consent (rejects when missing)', () => {
    const noConsent = {
      optinId: '550e8400-e29b-41d4-a716-446655440013',
      pageId: '550e8400-e29b-41d4-a716-446655440011',
      productId: 'prod_abc123def456',
      brandLane: 'lane_home_kitchen',
      contact: { email: 'lead@example.com' },
      source: 'email' as const,
      // consent intentionally missing
      capturedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => OptinCaptureSchema.parse(noConsent)).toThrow();
  });

  it('OptinCaptureSchema accepts a valid email opt-in with full consent block', () => {
    const ok = {
      optinId: '550e8400-e29b-41d4-a716-446655440013',
      pageId: '550e8400-e29b-41d4-a716-446655440011',
      productId: 'prod_abc123def456',
      brandLane: 'lane_home_kitchen',
      contact: { email: 'lead@example.com', name: 'Lead Person' },
      source: 'email' as const,
      consent: {
        policyVersion: 'v2026-04-01',
        consentedAt: '2026-06-29T12:00:00.000Z',
      },
      capturedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => OptinCaptureSchema.parse(ok)).not.toThrow();
  });

  it('LinkHealthSchema parses an ok probe with latency, and rejects unknown status', () => {
    const ok = {
      linkId: '550e8400-e29b-41d4-a716-446655440012',
      status: 'ok' as const,
      checkedAt: '2026-06-29T12:00:00.000Z',
      statusCode: 200,
      latencyMs: 142,
    };
    expect(() => LinkHealthSchema.parse(ok)).not.toThrow();

    const bad = {
      linkId: '550e8400-e29b-41d4-a716-446655440012',
      status: 'cosmic-ray', // not in enum
      checkedAt: '2026-06-29T12:00:00.000Z',
    };
    expect(() => LinkHealthSchema.parse(bad)).toThrow();
  });
});
