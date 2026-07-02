/**
 * Replicate API capability — backend entrypoint.
 *
 * Usage:
 *
 *   import { createReplicate } from '@multimarcdown/replicate-api';
 *
 *   const replicate = createReplicate({
 *     apiToken: process.env.REPLICATE_API_TOKEN!,
 *   });
 *
 *   const prediction = await replicate.predictions.create(
 *     {
 *       version: 'replicate/hello-world:5c7d5dc6dd8bf75c1acaa8565735e7986bc5b66206b55cca93cb72c9bf15ccaa',
 *       input: { text: 'Alice' },
 *     },
 *     { waitSeconds: 30 },
 *   );
 *   const final = await replicate.predictions.waitForCompletion(prediction.id);
 *
 * To wire health checks into `@multimarcdown/core`:
 *
 *   import { health } from '@multimarcdown/core';
 *   health.register('replicate-api', 'account', async () => {
 *     await replicate.account.get();
 *     return { state: 'healthy' };
 *   });
 */
import { ReplicateClient } from './replicate.client.js';
import { PredictionsService } from './predictions.service.js';
import { ModelsService } from './models.service.js';
import { DeploymentsService } from './deployments.service.js';
import { TrainingsService } from './trainings.service.js';
import { CollectionsService } from './collections.service.js';
import { HardwareService } from './hardware.service.js';
import { AccountService } from './account.service.js';
import { WebhooksService } from './webhooks.service.js';
import { SearchService } from './search.service.js';
import type { ReplicateClientConfig } from '../contracts/config.schema.js';

export { ReplicateClient, ReplicateApiError } from './replicate.client.js';
export { PredictionsService } from './predictions.service.js';
export { ModelsService } from './models.service.js';
export { DeploymentsService } from './deployments.service.js';
export { TrainingsService } from './trainings.service.js';
export { CollectionsService } from './collections.service.js';
export { HardwareService } from './hardware.service.js';
export { AccountService } from './account.service.js';
export { WebhooksService } from './webhooks.service.js';
export { SearchService } from './search.service.js';

export * from '../contracts/schemas.js';
export * from '../contracts/events.js';
export type {
  ReplicateClientConfig,
  ResolvedReplicateClientConfig,
} from '../contracts/config.schema.js';

export interface Replicate {
  client: ReplicateClient;
  predictions: PredictionsService;
  models: ModelsService;
  deployments: DeploymentsService;
  trainings: TrainingsService;
  collections: CollectionsService;
  hardware: HardwareService;
  account: AccountService;
  webhooks: WebhooksService;
  search: SearchService;
}

/**
 * Build a fully-wired Replicate facade. All resources share one client, so
 * auth, retries, and rate-limit handling are centralized.
 */
export function createReplicate(config: ReplicateClientConfig): Replicate {
  const client = new ReplicateClient(config);
  return {
    client,
    predictions: new PredictionsService(client),
    models: new ModelsService(client),
    deployments: new DeploymentsService(client),
    trainings: new TrainingsService(client),
    collections: new CollectionsService(client),
    hardware: new HardwareService(client),
    account: new AccountService(client),
    webhooks: new WebhooksService(client),
    search: new SearchService(client),
  };
}
