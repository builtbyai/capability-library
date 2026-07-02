/**
 * @multimarcdown/adapter-deepseek — DeepSeek implementation of the model-invocation port.
 *
 * Calls DeepSeek's Anthropic-compatible endpoint. Paired with the deepseek-router
 * capability, which owns tier pinning + cost re-computation.
 */
export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model?: 'deepseek-v4-pro' | 'deepseek-v4-flash';
}

export interface DeepSeekAdapter {
  complete(prompt: string, system?: string): Promise<string>;
}

export function createDeepSeekAdapter(_config: DeepSeekConfig): DeepSeekAdapter {
  throw new Error('adapter-deepseek: not implemented — supply a DeepSeek API key + endpoint binding');
}
