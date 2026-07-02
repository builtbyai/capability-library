import { z } from 'zod';

export const ReplicateClientConfigSchema = z.object({
  apiToken: z
    .string()
    .min(1, 'REPLICATE_API_TOKEN required (prefixed `r8_`).'),
  baseUrl: z.string().url().default('https://api.replicate.com/v1'),
  userAgent: z.string().default('multimarcdown-replicate-api/0.1.0'),
  fetch: z.custom<typeof fetch>().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
});

export type ReplicateClientConfig = z.input<typeof ReplicateClientConfigSchema>;
export type ResolvedReplicateClientConfig = z.infer<
  typeof ReplicateClientConfigSchema
>;
