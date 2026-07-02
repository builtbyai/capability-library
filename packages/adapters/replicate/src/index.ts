/**
 * @multimarcdown/adapter-replicate — Replicate implementation of the media-generation port.
 *
 * Thin provider binding for running Replicate predictions. The replicate-api
 * capability owns the full typed REST client; this adapter is the narrow
 * "run a model, get output URLs" surface media-generation consumes.
 */
export interface ReplicateConfig {
  apiToken: string;
}

export interface ReplicateRunInput {
  version: string;
  input: Record<string, unknown>;
}

export interface ReplicateAdapter {
  run(input: ReplicateRunInput): Promise<{ id: string; output: string[] }>;
}

export function createReplicateAdapter(_config: ReplicateConfig): ReplicateAdapter {
  throw new Error('adapter-replicate: not implemented — use the replicate-api capability client, or bind here');
}
