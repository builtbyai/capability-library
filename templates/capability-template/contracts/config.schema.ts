import { z } from 'zod';

/** Everything that must change on deploy lives here (one place). */
export const ConfigSchema = z.object({
  // example: apiBase: z.string().url(),
});

export type CapabilityConfig = z.infer<typeof ConfigSchema>;
