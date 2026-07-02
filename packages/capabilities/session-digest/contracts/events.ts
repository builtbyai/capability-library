/**
 * session-digest contracts. Three output variants from one input:
 *   - desktop HTML (A4-printable, branded; for archive)
 *   - mobile HTML (email-client-safe inline CSS; for sending)
 *   - caveman markdown (token-compressed; for LLM-to-LLM handoff)
 */
import { z } from 'zod';

export const DigestSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('claude-session'), transcriptPath: z.string() }),
  z.object({ kind: z.literal('bus-window'), fromAt: z.string().datetime(), toAt: z.string().datetime(), filterPrefixes: z.array(z.string()).default([]) }),
  z.object({ kind: z.literal('whatsapp-chat'), chatId: z.string(), fromAt: z.string().datetime(), toAt: z.string().datetime() }),
  z.object({ kind: z.literal('manual'), markdown: z.string() }),
]);
export type DigestSource = z.infer<typeof DigestSourceSchema>;

export const DigestVariantSchema = z.enum(['desktop', 'mobile', 'caveman']);
export type DigestVariant = z.infer<typeof DigestVariantSchema>;

export const DigestRequestSchema = z.object({
  source: DigestSourceSchema,
  variants: z.array(DigestVariantSchema).default(['desktop', 'mobile', 'caveman']),
  templateId: z.string().optional(),
  /** ImpactIQ/OnlyJalen/WTS-flavored — picks accent color + logo. */
  brand: z.enum(['ward-tech-systems', 'impactiq', 'onlyjalen', 'generic']).default('ward-tech-systems'),
});
export type DigestRequest = z.infer<typeof DigestRequestSchema>;

export const DigestRecordSchema = z.object({
  digestId: z.string().uuid(),
  source: DigestSourceSchema,
  brand: z.string(),
  /** Per-variant artifact paths under the digest store. */
  artifacts: z.record(DigestVariantSchema, z.string()).default({}),
  /** Token count of the source (informational, helps the user judge cost). */
  sourceTokens: z.number().int().optional(),
  generatedAt: z.string().datetime(),
});
export type DigestRecord = z.infer<typeof DigestRecordSchema>;

export const DigestRequestedEvent       = z.object({ event: z.literal('digest.requested'), request: DigestRequestSchema, at: z.string() });
export const DigestGeneratedEvent       = z.object({ event: z.literal('digest.generated'), record: DigestRecordSchema });
export const DigestHtmlRenderedEvent    = z.object({ event: z.literal('digest.html-rendered'), digestId: z.string().uuid(), variant: DigestVariantSchema, artifactPath: z.string() });
export const DigestCavemanRenderedEvent = z.object({ event: z.literal('digest.caveman-rendered'), digestId: z.string().uuid(), artifactPath: z.string(), compressionRatio: z.number() });
export const DigestSentEvent            = z.object({ event: z.literal('digest.sent'), digestId: z.string().uuid(), channel: z.string(), deliveryId: z.string() });
export const DigestFailedEvent          = z.object({ event: z.literal('digest.failed'), request: DigestRequestSchema, error: z.string(), stage: z.enum(['ingest', 'render-desktop', 'render-mobile', 'render-caveman', 'send']) });

export const EVENT_NAMES = {
  requested: 'digest.requested',
  generated: 'digest.generated',
  htmlRendered: 'digest.html-rendered',
  cavemanRendered: 'digest.caveman-rendered',
  sent: 'digest.sent',
  failed: 'digest.failed',
} as const;

export interface SessionDigestPort {
  generate(req: DigestRequest): Promise<DigestRecord>;
  getHtml(digestId: string, variant: 'desktop' | 'mobile'): Promise<string>;
  getCaveman(digestId: string): Promise<string>;
  send(digestId: string, opts: { channel: string; audience: string }): Promise<{ deliveryId: string }>;
}
