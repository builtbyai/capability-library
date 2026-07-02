import { z } from 'zod';
import type { ReplicateClient } from './replicate.client.js';
import { Hardware } from '../contracts/schemas.js';

const HardwareList = z.array(Hardware);

export class HardwareService {
  constructor(private readonly client: ReplicateClient) {}

  list(): Promise<z.infer<typeof Hardware>[]> {
    return this.client.requestParsed(HardwareList, 'hardware');
  }
}
