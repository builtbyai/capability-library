/**
 * @multimarcdown/adapter-ollama — local Ollama implementation of the model-invocation port.
 *
 * Chat + embeddings against a local Ollama server (default http://127.0.0.1:11434),
 * used by ai-orchestration, vectorize, and knowledge-index for zero-cost inference.
 */
export interface OllamaConfig {
  baseUrl?: string;
  model: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaAdapter {
  chat(messages: ChatMessage[]): Promise<string>;
  embed(input: string | string[]): Promise<number[][]>;
}

export function createOllamaAdapter(config: OllamaConfig): OllamaAdapter {
  const baseUrl = config.baseUrl ?? 'http://127.0.0.1:11434';
  return {
    async chat(messages) {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages, stream: false }),
      });
      if (!res.ok) throw new Error(`ollama chat failed: HTTP ${res.status}`);
      const json = (await res.json()) as { message?: { content?: string } };
      return json.message?.content ?? '';
    },
    async embed(input) {
      const inputs = Array.isArray(input) ? input : [input];
      const res = await fetch(`${baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: config.model, input: inputs }),
      });
      if (!res.ok) throw new Error(`ollama embed failed: HTTP ${res.status}`);
      const json = (await res.json()) as { embeddings?: number[][] };
      return json.embeddings ?? [];
    },
  };
}
