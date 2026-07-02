import type { ReplicateClient } from './replicate.client.js';
import {
  Model,
  ModelVersion,
  Prediction,
  type Paginated,
  type WebhookEvent,
} from '../contracts/schemas.js';

export type ModelVisibility = 'public' | 'private';

export interface CreateModelInput {
  owner: string;
  name: string;
  hardware: string;
  visibility: ModelVisibility;
  description?: string;
  cover_image_url?: string;
  github_url?: string;
  paper_url?: string;
  license_url?: string;
}

export interface UpdateModelInput {
  description?: string;
  readme?: string;
  github_url?: string;
  paper_url?: string;
  weights_url?: string;
  license_url?: string;
}

export interface ListModelsQuery {
  sort_by?: 'model_created_at' | 'latest_version_created_at';
  sort_direction?: 'asc' | 'desc';
}

export interface CreateOfficialModelPredictionInput {
  input: Record<string, unknown>;
  webhook?: string;
  webhook_events_filter?: WebhookEvent[];
  /** Deprecated. */
  stream?: boolean;
}

export class ModelsService {
  constructor(private readonly client: ReplicateClient) {}

  create(body: CreateModelInput): Promise<Model> {
    return this.client.requestParsed(Model, 'models', {
      method: 'POST',
      body,
    });
  }

  get(owner: string, name: string): Promise<Model> {
    return this.client.requestParsed(Model, modelPath(owner, name));
  }

  listPages(
    query: ListModelsQuery = {},
  ): AsyncGenerator<Model[], void, void> {
    return this.client.paginate(Model, 'models', {
      query: query as Record<string, string | undefined>,
    });
  }

  listAll(query: ListModelsQuery = {}): Promise<Model[]> {
    return this.client.paginateAll(Model, 'models', {
      query: query as Record<string, string | undefined>,
    });
  }

  update(owner: string, name: string, body: UpdateModelInput): Promise<Model> {
    return this.client.requestParsed(Model, modelPath(owner, name), {
      method: 'PATCH',
      body,
    });
  }

  /**
   * Public model search. Uses the non-standard `QUERY` HTTP method on
   * /v1/models with a plain-text body — this is the documented contract.
   */
  async search(query: string): Promise<Paginated<Model>> {
    const raw = await this.client.request<Paginated<unknown>>('models', {
      method: 'QUERY',
      rawTextBody: query,
      contentType: 'text/plain',
    });
    return {
      next: raw.next,
      previous: raw.previous,
      results: raw.results.map((r) => Model.parse(r)),
    };
  }

  delete(owner: string, name: string): Promise<void> {
    return this.client.request<void>(modelPath(owner, name), {
      method: 'DELETE',
    });
  }

  readme(owner: string, name: string): Promise<string> {
    return this.client.request<string>(`${modelPath(owner, name)}/readme`, {
      headers: { Accept: 'text/plain' },
    });
  }

  // -- examples --
  examplesPages(
    owner: string,
    name: string,
  ): AsyncGenerator<Prediction[], void, void> {
    return this.client.paginate(
      Prediction,
      `${modelPath(owner, name)}/examples`,
    );
  }

  examplesAll(owner: string, name: string): Promise<Prediction[]> {
    return this.client.paginateAll(
      Prediction,
      `${modelPath(owner, name)}/examples`,
    );
  }

  // -- official-model predictions --
  createOfficialPrediction(
    owner: string,
    name: string,
    body: CreateOfficialModelPredictionInput,
    opts: { waitSeconds?: number; cancelAfter?: string } = {},
  ): Promise<Prediction> {
    return this.client.requestParsed(
      Prediction,
      `${modelPath(owner, name)}/predictions`,
      {
        method: 'POST',
        body,
        waitSeconds: opts.waitSeconds,
        cancelAfter: opts.cancelAfter,
      },
    );
  }

  // -- versions --
  versions = {
    get: (owner: string, name: string, versionId: string) =>
      this.client.requestParsed(
        ModelVersion,
        `${modelPath(owner, name)}/versions/${encodeURIComponent(versionId)}`,
      ),
    listPages: (owner: string, name: string) =>
      this.client.paginate(
        ModelVersion,
        `${modelPath(owner, name)}/versions`,
      ),
    listAll: (owner: string, name: string) =>
      this.client.paginateAll(
        ModelVersion,
        `${modelPath(owner, name)}/versions`,
      ),
    delete: (owner: string, name: string, versionId: string) =>
      this.client.request<void>(
        `${modelPath(owner, name)}/versions/${encodeURIComponent(versionId)}`,
        { method: 'DELETE' },
      ),
  };
}

function modelPath(owner: string, name: string): string {
  return `models/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}
