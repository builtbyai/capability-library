/** gpu-balanced-inference -- gpu-router decides host; capability fallback handles overload. */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';

export function register(): () => void {
  return bus.on('gpu.host.overloaded', async (e: CoreEvent) => {
    // All hosts overloaded; emit a notify so the user knows inference is degrading.
    await jobs.enqueue('notify', 'dispatch', {
      source: 'gpu-balanced-inference',
      severity: 'warn',
      audience: 'me',
      title: 'Fleet GPU overload',
      body: 'All fleet GPUs over threshold; falling back to deepseek-router for inference.',
      meta: e.payload,
    });
  });
}
