import type { ReplicateClient } from './replicate.client.js';
import {
  Deployment,
  Prediction,
  type WebhookEvent,
} from '../contracts/schemas.js';

export interface CreateDeploymentInput {
  name: string;
  model: string;
  version: string;
  hardware: string;
  min_instances: number;
  max_instances: number;
}

export interface UpdateDeploymentInput {
  hardware?: string;
  min_instances?: number;
  max_instances?: number;
  version?: string;
}

export interface CreateDeploymentPredictionInput {
  input: Record<string, unknown>;
  webhook?: string;
  webhook_events_filter?: WebhookEvent[];
  /** Deprecated. */
  stream?: boolean;
}

export class DeploymentsService {
  constructor(private readonly client: ReplicateClient) {}

  create(body: CreateDeploymentInput): Promise<Deployment> {
    return this.client.requestParsed(Deployment, 'deployments', {
      method: 'POST',
      body,
    });
  }

  get(owner: string, name: string): Promise<Deployment> {
    return this.client.requestParsed(Deployment, deployPath(owner, name));
  }

  listPages(): AsyncGenerator<Deployment[], void, void> {
    return this.client.paginate(Deployment, 'deployments');
  }

  listAll(): Promise<Deployment[]> {
    return this.client.paginateAll(Deployment, 'deployments');
  }

  update(
    owner: string,
    name: string,
    body: UpdateDeploymentInput,
  ): Promise<Deployment> {
    return this.client.requestParsed(Deployment, deployPath(owner, name), {
      method: 'PATCH',
      body,
    });
  }

  delete(owner: string, name: string): Promise<void> {
    return this.client.request<void>(deployPath(owner, name), {
      method: 'DELETE',
    });
  }

  createPrediction(
    owner: string,
    name: string,
    body: CreateDeploymentPredictionInput,
    opts: { waitSeconds?: number; cancelAfter?: string } = {},
  ): Promise<Prediction> {
    return this.client.requestParsed(
      Prediction,
      `${deployPath(owner, name)}/predictions`,
      {
        method: 'POST',
        body,
        waitSeconds: opts.waitSeconds,
        cancelAfter: opts.cancelAfter,
      },
    );
  }
}

function deployPath(owner: string, name: string): string {
  return `deployments/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}
