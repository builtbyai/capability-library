/**
 * @multimarcdown/adapter-anthropic — Anthropic Messages implementation of the model-invocation port.
 *
 * Thin binding over the Anthropic Messages API. Supply an API key; wire the
 * official @anthropic-ai/sdk (or fetch) in createAnthropicAdapter.
 */
export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface AnthropicAdapter {
  complete(prompt: string, system?: string): Promise<string>;
}

export function createAnthropicAdapter(_config: AnthropicConfig): AnthropicAdapter {
  throw new Error('adapter-anthropic: not implemented — supply an Anthropic API key + SDK/fetch binding');
}
