import { describe, it, expect } from 'vitest';
import { hashStream, hashBytes } from '../src/checksums.js';
import { createHash } from 'node:crypto';

const enc = new TextEncoder();

async function* yieldChunks(parts: string[]): AsyncIterable<Uint8Array> {
  for (const p of parts) yield enc.encode(p);
}

describe('hashStream', () => {
  it('hashes a single-chunk stream identically to a one-shot hash', async () => {
    const text = 'hello world';
    const expected = createHash('sha256').update(text).digest('hex');
    const { stream, hash } = hashStream(yieldChunks([text]));
    for await (const _ of stream) { /* consume */ }
    expect(await hash).toBe(expected);
  });

  it('hashes a multi-chunk stream identically to a one-shot hash', async () => {
    const parts = ['hel', 'lo ', 'wor', 'ld'];
    const expected = createHash('sha256').update(parts.join('')).digest('hex');
    const { stream, hash } = hashStream(yieldChunks(parts));
    for await (const _ of stream) { /* consume */ }
    expect(await hash).toBe(expected);
  });

  it('tees bytes through unchanged', async () => {
    const parts = ['abc', 'def'];
    const { stream } = hashStream(yieldChunks(parts));
    const out: string[] = [];
    for await (const c of stream) out.push(new TextDecoder().decode(c));
    expect(out.join('')).toBe('abcdef');
  });
});

describe('hashBytes', () => {
  it('matches node:crypto sha256', () => {
    const buf = enc.encode('hello');
    expect(hashBytes(buf)).toBe(createHash('sha256').update(buf).digest('hex'));
  });
});
