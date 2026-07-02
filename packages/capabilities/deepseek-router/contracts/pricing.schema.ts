// Pricing contract for deepseek-router.
// Single source of truth for the rate tables used by `ds-cost`.
// Mirror any changes here into:
//   - backend/ds-cost              (the RATES constant near the top)
//   - manifest.yaml                (the `pricing:` block)
//   - docs/diagnostics.runbook.md  ("How to verify pricing rates" section)

import { z } from 'zod';

export const TierSchema = z.enum(['flash', 'pro']);
export type Tier = z.infer<typeof TierSchema>;

export const RateCardSchema = z.object({
  // Per 1M tokens, USD.
  input_miss: z.number().positive(),
  input_hit: z.number().positive(),
  output: z.number().positive(),
  server_model: z.string(),
});
export type RateCard = z.infer<typeof RateCardSchema>;

// Verified against https://api-docs.deepseek.com/quick_start/pricing
// on 2026-06-28. If DeepSeek changes prices, update here AND in ds-cost.
export const PRICING: Record<Tier, RateCard> = {
  flash: {
    input_miss: 0.14,
    input_hit: 0.0028,
    output: 0.28,
    server_model: 'deepseek-v4-flash',
  },
  pro: {
    input_miss: 0.435,
    input_hit: 0.003625,
    output: 0.87,
    server_model: 'deepseek-v4-pro',
  },
};

// Maps Anthropic-style model names to the local tier the wrapper should pin.
// DeepSeek's server-side mapping is the same shape (opus->pro, else->flash)
// but this lets a TS consumer reason about tier selection locally.
export function tierFromModel(model: string | null | undefined): Tier {
  if (!model) return 'pro'; // CC default is opus-class
  const m = model.toLowerCase();
  if (m.includes('opus')) return 'pro';
  return 'flash';
}

export interface UsageBlock {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface CostBreakdown {
  tier: Tier;
  inputFresh: number;
  inputCached: number;
  output: number;
  costUSD: number;
}

export function computeCost(u: UsageBlock, tier: Tier): CostBreakdown {
  const rates = PRICING[tier];
  const inTok = u.input_tokens ?? 0;
  const cacheRd = u.cache_read_input_tokens ?? 0;
  const inFresh = Math.max(0, inTok - cacheRd);
  const outTok = u.output_tokens ?? 0;
  const costUSD =
    (inFresh * rates.input_miss) / 1e6 +
    (cacheRd * rates.input_hit) / 1e6 +
    (outTok * rates.output) / 1e6;
  return { tier, inputFresh: inFresh, inputCached: cacheRd, output: outTok, costUSD };
}
