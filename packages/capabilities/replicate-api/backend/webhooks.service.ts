import type { ReplicateClient } from './replicate.client.js';
import { WebhookSecret } from '../contracts/schemas.js';

export class WebhooksService {
  constructor(private readonly client: ReplicateClient) {}

  /** Get the signing secret for the *default* webhook endpoint. */
  defaultSecret(): Promise<import('../contracts/schemas.js').WebhookSecret> {
    return this.client.requestParsed(WebhookSecret, 'webhooks/default/secret');
  }
}
