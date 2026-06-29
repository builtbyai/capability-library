/**
 * Health check registry.
 *
 * Every capability registers one or more checks; the dashboard rolls them up.
 * A check is just an async fn returning a state + detail. The aggregate state
 * is the worst of its parts (failed > degraded > healthy).
 */
import type { HealthCheckResult, HealthState, HealthStatus } from './types.js';

// `name` is supplied to register() and re-attached in status(); a check body
// only reports state + detail. `durationMs` is measured by the registry.
export type Check = () => Promise<Omit<HealthCheckResult, 'durationMs' | 'name'>>;

const order: Record<HealthState, number> = { healthy: 0, unknown: 1, degraded: 2, failed: 3 };

export class HealthRegistry {
  private checks = new Map<string, Map<string, Check>>();

  /** Register a check under a capability id. Returns an unregister fn. */
  register(capabilityId: string, name: string, check: Check): () => void {
    let group = this.checks.get(capabilityId);
    if (!group) {
      group = new Map();
      this.checks.set(capabilityId, group);
    }
    group.set(name, check);
    return () => group!.delete(name);
  }

  /** Run all checks for one capability and produce an aggregate status. */
  async status(capabilityId: string): Promise<HealthStatus> {
    const group = this.checks.get(capabilityId);
    if (!group || group.size === 0) {
      return { state: 'unknown', summary: 'no checks registered', checkedAt: new Date().toISOString() };
    }
    const results: HealthCheckResult[] = [];
    for (const [name, check] of group) {
      const start = Date.now();
      try {
        const r = await check();
        results.push({ ...r, name, durationMs: Date.now() - start });
      } catch (err) {
        results.push({
          name,
          state: 'failed',
          detail: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        });
      }
    }
    const worst = results.reduce<HealthState>((acc, r) => (order[r.state] > order[acc] ? r.state : acc), 'healthy');
    return {
      state: worst,
      summary: summarize(worst, results),
      checks: results,
      checkedAt: new Date().toISOString(),
    };
  }
}

function summarize(state: HealthState, results: HealthCheckResult[]): string {
  if (state === 'healthy') return `${results.length}/${results.length} checks passing`;
  const bad = results.filter((r) => r.state !== 'healthy').map((r) => r.name);
  return `${bad.length} of ${results.length} checks not healthy: ${bad.join(', ')}`;
}

export const health = new HealthRegistry();
