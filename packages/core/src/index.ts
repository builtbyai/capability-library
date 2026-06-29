/**
 * @multimarcdown/core — the abstractions every capability builds on.
 *
 *   import { bus, jobs, health, secrets, createLogger, parseManifest } from '@multimarcdown/core';
 */
export * from './types.js';
export * from './manifest.js';
export {
  loadRegistry,
  resolveCapabilities,
  findRepoRoot,
  type Registry,
  type RegistryEntry,
  type ResolvedCapability,
} from './registry.js';
export * from './events.js';
export * from './jobs.js';
export * from './health.js';
export * from './secrets.js';
export * from './config.js';
export * from './logging.js';
export * from './diagnostics.js';

// Shared primitives hoisted from capabilities (see knowledge/decisions/* for rationale).
export * from './intake.js';
export * from './chunks.js';
export * from './backoff.js';
export * from './checksums.js';
export * from './mime-sniff.js';
export * from './throttle.js';
export * from './http-client.js';
export * from './cost-ledger.js';
export * from './dry-run.js';
export * from './model-invocation.js';
