/** notify-on-cost-spike -- cost.recorded -> notify (when rolling hour > threshold). */
import { bus, type CoreEvent } from '@multimarcdown/core';

const HOURLY_USD_THRESHOLD = 1.0;
const window = new Map<string, { totalUSD: number; resetAt: number }>();
const HOUR_MS = 60 * 60 * 1000;

/**
 * Canonical 1.0.0 `cost.recorded` payload subset (mirrors
 * `CostRecordedSchema` in @multimarcdown/cost-ledger). We only need the
 * fields we read here — `provider` for window keying, `totalCost` for the
 * sum.
 */
interface CostRecordedPayload {
  provider: string;
  totalCost: number;
}

export function register(): () => void {
  return bus.on('cost.recorded', async (e: CoreEvent) => {
    const entry = e.payload as CostRecordedPayload;
    const now = Date.now();
    const cur = window.get(entry.provider) ?? { totalUSD: 0, resetAt: now + HOUR_MS };
    if (now > cur.resetAt) { cur.totalUSD = 0; cur.resetAt = now + HOUR_MS; }
    cur.totalUSD += entry.totalCost;
    window.set(entry.provider, cur);
    if (cur.totalUSD <= HOURLY_USD_THRESHOLD) return;
    await import('@multimarcdown/core').then(({ jobs }) => jobs.enqueue('notify', 'dispatch', {
      source: 'cost-ledger',
      severity: 'warn',
      audience: 'me',
      title: `Cost spike: ${entry.provider}`,
      body: `Rolling hour USD ${cur.totalUSD.toFixed(2)} exceeded threshold ${HOURLY_USD_THRESHOLD}`,
      meta: { provider: entry.provider, windowUSD: cur.totalUSD },
    }));
    cur.totalUSD = 0; // debounce: silence until next window
  });
}
