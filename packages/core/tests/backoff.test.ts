import { describe, it, expect } from 'vitest';
import { withBackoff } from '../src/backoff.js';

describe('withBackoff', () => {
  it('returns immediately on success', async () => {
    let calls = 0;
    const result = await withBackoff(
      async () => { calls++; return 'ok'; },
      { maxAttempts: 5, backoff: 'fixed', baseMs: 1 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries until success', async () => {
    let calls = 0;
    const result = await withBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error('try again');
        return 'ok';
      },
      { maxAttempts: 5, backoff: 'fixed', baseMs: 1 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws after maxAttempts', async () => {
    let calls = 0;
    await expect(
      withBackoff(
        async () => { calls++; throw new Error('always fails'); },
        { maxAttempts: 3, backoff: 'fixed', baseMs: 1 },
      ),
    ).rejects.toThrow('always fails');
    expect(calls).toBe(3);
  });

  it('stops on fail classification', async () => {
    let calls = 0;
    await expect(
      withBackoff(
        async () => { calls++; throw new Error('fatal'); },
        { maxAttempts: 5, backoff: 'fixed', baseMs: 1 },
        () => 'fail',
      ),
    ).rejects.toThrow('fatal');
    expect(calls).toBe(1);
  });

  it('exponential backoff grows', async () => {
    const delays: number[] = [];
    let calls = 0;
    await withBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error('retry');
        return null;
      },
      { maxAttempts: 5, backoff: 'exponential', baseMs: 10, jitterFraction: 0 },
      undefined,
      (a) => delays.push(a.delayMs),
    );
    expect(delays).toEqual([10, 20]);
  });
});
