import { describe, it, expect } from 'vitest';
import { jobs } from '../src/jobs.js';

const fast = { maxAttempts: 1, backoff: 'fixed', baseMs: 1 } as const;

describe('jobs.run', () => {
  it('resolves with the handler output', async () => {
    jobs.register<{ x: number }, { doubled: number }>('runtest:double', async (ctx) => ({
      doubled: ctx.input.x * 2,
    }));
    const out = await jobs.run<{ doubled: number }, { x: number }>('runtest', 'double', { x: 21 });
    expect(out.doubled).toBe(42);
  });

  it('rejects when the handler throws', async () => {
    jobs.register('runtest:boom', async () => {
      throw new Error('kaboom');
    });
    await expect(jobs.run('runtest', 'boom', {}, fast)).rejects.toThrow('kaboom');
  });

  it('rejects when no handler is registered', async () => {
    await expect(jobs.run('runtest', 'missing', {}, fast)).rejects.toThrow(/no handler/);
  });

  it('times out (and does not hang) when the handler never settles', async () => {
    jobs.register('runtest:hang', () => new Promise<never>(() => {}));
    await expect(jobs.run('runtest', 'hang', {}, fast, 40)).rejects.toThrow(/timed out/);
  });
});
