import type { ReplicateClient } from './replicate.client.js';
import { Collection } from '../contracts/schemas.js';

export class CollectionsService {
  constructor(private readonly client: ReplicateClient) {}

  get(slug: string): Promise<Collection> {
    return this.client.requestParsed(
      Collection,
      `collections/${encodeURIComponent(slug)}`,
    );
  }

  listPages(): AsyncGenerator<Collection[], void, void> {
    return this.client.paginate(Collection, 'collections');
  }

  listAll(): Promise<Collection[]> {
    return this.client.paginateAll(Collection, 'collections');
  }
}
