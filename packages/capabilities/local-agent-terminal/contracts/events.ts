/**
 * local-agent-terminal events — declared in manifest.yaml so they need a
 * typed contract. `pty:send-to-claude` is the one event this capability emits
 * (other capabilities can post text into an attached terminal session).
 */
import { z } from 'zod';

export const PtySendToClaudeSchema = z.object({
  event: z.literal('pty:send-to-claude'),
  sessionId: z.string(),
  text: z.string(),
  /** Where the prompt came from (UI prompt bar, workflow handler, etc.). */
  source: z.string(),
});
export type PtySendToClaude = z.infer<typeof PtySendToClaudeSchema>;

export const EVENT_NAMES = {
  sendToClaude: 'pty:send-to-claude',
} as const;
