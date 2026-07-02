import type { ReplicateClient } from './replicate.client.js';
import { Training, type WebhookEvent } from '../contracts/schemas.js';

export interface CreateTrainingInput {
  /** `{destination_owner}/{destination_name}` — must already exist. */
  destination: string;
  input: Record<string, unknown>;
  webhook?: string;
  webhook_events_filter?: WebhookEvent[];
}

export class TrainingsService {
  constructor(private readonly client: ReplicateClient) {}

  create(
    modelOwner: string,
    modelName: string,
    versionId: string,
    body: CreateTrainingInput,
  ): Promise<Training> {
    const path =
      `models/${encodeURIComponent(modelOwner)}` +
      `/${encodeURIComponent(modelName)}` +
      `/versions/${encodeURIComponent(versionId)}/trainings`;
    return this.client.requestParsed(Training, path, {
      method: 'POST',
      body,
    });
  }

  get(id: string): Promise<Training> {
    return this.client.requestParsed(
      Training,
      `trainings/${encodeURIComponent(id)}`,
    );
  }

  listPages(): AsyncGenerator<Training[], void, void> {
    return this.client.paginate(Training, 'trainings');
  }

  listAll(): Promise<Training[]> {
    return this.client.paginateAll(Training, 'trainings');
  }

  cancel(id: string): Promise<void> {
    return this.client.request<void>(
      `trainings/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' },
    );
  }

  async waitForCompletion(
    id: string,
    opts: {
      initialIntervalMs?: number;
      maxIntervalMs?: number;
      timeoutMs?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<Training> {
    const start = Date.now();
    const initial = opts.initialIntervalMs ?? 5_000;
    const max = opts.maxIntervalMs ?? 30_000;
    const timeout = opts.timeoutMs ?? 4 * 60 * 60_000;
    let delay = initial;
    while (true) {
      if (opts.signal?.aborted) throw new Error('aborted');
      const t = await this.get(id);
      if (
        t.status === 'succeeded' ||
        t.status === 'failed' ||
        t.status === 'canceled'
      ) {
        return t;
      }
      if (Date.now() - start > timeout) {
        throw new Error(
          `Timed out waiting for training ${id} (last status: ${t.status})`,
        );
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(max, Math.round(delay * 1.5));
    }
  }
}
