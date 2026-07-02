import type { ReplicateClient } from './replicate.client.js';
import { Account } from '../contracts/schemas.js';

export class AccountService {
  constructor(private readonly client: ReplicateClient) {}

  get(): Promise<import('../contracts/schemas.js').Account> {
    return this.client.requestParsed(Account, 'account');
  }
}
