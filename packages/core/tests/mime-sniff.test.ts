import { describe, it, expect } from 'vitest';
import { sniffMime } from '../src/mime-sniff.js';

describe('sniffMime', () => {
  it('detects PDF', () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(sniffMime(bytes)).toEqual({ mime: 'application/pdf', ext: 'pdf' });
  });

  it('detects PNG', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(sniffMime(bytes)).toEqual({ mime: 'image/png', ext: 'png' });
  });

  it('detects JPEG', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffMime(bytes)).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
  });

  it('rejects an HTML payload masquerading as image/jpeg', () => {
    // The bulk-media-import sharp-edge: SPA returns HTML with image/jpeg header.
    // Magic bytes must defeat the lie.
    const html = new TextEncoder().encode('<!DOCTYPE html><html>');
    const result = sniffMime(html);
    // We should NOT detect it as jpeg; should detect as html (or null, but we have an html magic).
    expect(result?.mime).not.toBe('image/jpeg');
    expect(result?.mime).toBe('text/html');
  });

  it('returns null for unknown bytes', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(sniffMime(bytes)).toBeNull();
  });

  it('returns null for too-short input', () => {
    const bytes = new Uint8Array([0x25, 0x50]);
    expect(sniffMime(bytes)).toBeNull();
  });
});
