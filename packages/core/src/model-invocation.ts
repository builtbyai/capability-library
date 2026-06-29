/**
 * ModelInvocation — the port capabilities depend on instead of binding to a
 * specific AI provider. ai-file-renamer needs naming inference; media-processing
 * needs vision tagging; web-clipper might want summarization. None of them
 * should `import deepseekRouter`.
 *
 * Implementations live in `packages/adapters/{deepseek,anthropic,ollama,replicate,openai}/`.
 * Each adapter exports a ready-to-use `ModelInvocation` and (optionally) a
 * factory for tier/profile customization.
 */

export type InvocationMode = 'chat' | 'code' | 'vision' | 'json';

export interface ModelImageInput {
  /** Either a public URL or a base64 data URI. */
  src: string;
  mimeType?: string;
}

export interface ModelRequest {
  prompt: string;
  mode?: InvocationMode;
  images?: ModelImageInput[];
  maxTokens?: number;
  temperature?: number;
  /** Provider-tier hint (e.g. 'flash'|'pro' for deepseek, 'haiku'|'sonnet'|'opus' for anthropic). */
  tier?: string;
  /** Identifies the calling capability so the adapter can stamp cost-ledger entries. */
  capabilityId: string;
  /** Optional ID for cost ledger correlation. */
  jobId?: string;
}

export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

export interface ModelResponse {
  text: string;
  usage: ModelUsage;
  costUSD: number;
  provider: string;
  tier: string;
  /** Latency from request start to response. */
  wallMs: number;
}

export type ModelInvocation = (req: ModelRequest) => Promise<ModelResponse>;
