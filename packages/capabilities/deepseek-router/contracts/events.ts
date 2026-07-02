/**
 * deepseek-router contracts. Cost-tracking events for any consumer that wants
 * to observe DeepSeek usage. The router itself shells out to claude-deepseek
 * with --output-format json and computes cost from the usage block; emit one
 * event per completion.
 */
import { z } from 'zod';
import { TierSchema } from './pricing.schema.js';

export const DeepSeekCompletionEvent = z.object({
  event: z.literal('deepseek.completion'),
  tier: TierSchema,
  mode: z.enum(['interactive', 'code', 'agent', 'pipeline']),
  tokens: z.object({
    input: z.number().int().nonnegative(),
    cache_read: z.number().int().nonnegative(),
    cache_creation: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
  }),
  costUSD: z.number().nonnegative(),
  ccPrintedUSD: z.number().nullable(),
  overstatementRatio: z.number().nullable(),
  wallMs: z.number().int().nonnegative(),
  at: z.string(),
});
export type DeepSeekCompletionEvent = z.infer<typeof DeepSeekCompletionEvent>;

export const EVENT_NAMES = {
  completion: 'deepseek.completion',
} as const;
