/**
 * deepseek-router backend surface.
 *
 * The router CLI lives in backend/ as shell entrypoints (claude-deepseek, ds-cost,
 * *.bat). This module is the typed, importable core of the router: the tier-pinning
 * map that points Claude Code model tiers at DeepSeek's Anthropic-compatible
 * endpoint, plus the health registration. Cost re-computation shapes live in
 * contracts/pricing.schema.ts (consumed by ds-cost).
 */
import { health } from '@multimarcdown/core';

export const CAPABILITY_ID = 'deepseek-router';

export type ClaudeTier = 'opus' | 'sonnet' | 'haiku';
export type DeepSeekModel = 'deepseek-v4-pro' | 'deepseek-v4-flash';

/**
 * Tier pinning (per manifest): opus → v4-pro (reasoning-grade), sonnet/haiku →
 * v4-flash (fast/cheap). Keeps codegen turns on the cheapest capable model.
 */
export const TIER_PINNING: Record<ClaudeTier, DeepSeekModel> = {
  opus: 'deepseek-v4-pro',
  sonnet: 'deepseek-v4-flash',
  haiku: 'deepseek-v4-flash',
};

/** Map an incoming Claude model tier to the DeepSeek model the router should call. */
export function resolveModel(tier: ClaudeTier): DeepSeekModel {
  return TIER_PINNING[tier];
}

/** Register health checks + job handlers with the core singletons. */
export function register(): void {
  health.register(CAPABILITY_ID, 'endpoint', async () => ({
    state: 'unknown',
    detail: 'CLI wrapper (backend/claude-deepseek, backend/ds-cost) — no long-running service to probe',
  }));
}
