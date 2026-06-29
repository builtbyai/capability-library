/**
 * The CapabilityManifest is what makes the library machine-readable.
 *
 * Every capability ships a `manifest.yaml` that declares its surfaces, required
 * env/secrets, ports, provided routes/events, risk level, and health checks.
 * A dashboard can read these to install, configure, and diagnose a capability
 * without anyone hand-reading the source.
 */
import { z } from 'zod';

export const RiskLevelSchema = z.enum([
  'normal',
  'sensitive-data',
  'filesystem-read',
  'filesystem-write',
  'privileged',
  'external-ai-processing',
  'scheduled-automation',
  'network-bridge',
  'data-processing',
  'knowledge-index',
  'automation',
]);

export const CapabilityKindSchema = z.enum(['ui', 'feature', 'capability', 'workflow', 'adapter']);

const FrontendRuntimeSchema = z.object({
  framework: z.literal('react').default('react'),
  packages: z.array(z.string()).default([]),
  /** Exported UI surfaces (component names). */
  surfaces: z.array(z.string()).default([]),
});

const BackendRuntimeSchema = z.object({
  platform: z.literal('node').default('node'),
  packages: z.array(z.string()).default([]),
  ports: z.array(z.number()).default([]),
});

const CloudRuntimeSchema = z.object({
  provider: z.enum(['cloudflare']),
  resources: z.array(z.enum(['worker', 'durable-object', 'queue', 'r2', 'd1', 'vectorize'])).default([]),
});

const CliRuntimeSchema = z.object({
  platform: z.literal('node').default('node'),
  minVersion: z.string().optional(),
  packages: z.array(z.string()).default([]),
  entrypoints: z.array(z.string()).default([]),
  peerBinaries: z.array(z.string()).default([]),
});

const BrowserRuntimeSchema = z.object({
  optional: z.boolean().default(false),
  surfaces: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const HealthCheckSchema = z.object({
  name: z.string(),
  /** A shell probe or a logical id resolved by the capability at runtime. */
  probe: z.string(),
  expect: z.string().optional(),
});

const LaunchProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  command: z.string(),
  riskLevel: RiskLevelSchema.default('normal'),
  requiresConfirmation: z.boolean().default(false),
  allowedWorkingDirectories: z.array(z.string()).optional(),
});

export const CapabilityManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().default('0.1.0'),
  kind: CapabilityKindSchema.default('capability'),
  status: z.enum(['prototype', 'planned', 'beta', 'production-ready']).default('planned'),
  riskLevel: RiskLevelSchema.default('normal'),
  description: z.string().default(''),

  runtime: z
    .object({
      frontend: FrontendRuntimeSchema.optional(),
      backend: BackendRuntimeSchema.optional(),
      cloud: CloudRuntimeSchema.optional(),
      cli: CliRuntimeSchema.optional(),
      browser: BrowserRuntimeSchema.optional(),
    })
    .default({}),

  /** Things that must exist in the host environment before this works. */
  requires: z
    .object({
      env: z.array(z.string()).default([]),
      browserStorage: z.array(z.string()).default([]),
      ports: z.array(z.number()).default([]),
      capabilities: z.array(z.string()).default([]),
    })
    .default({}),

  /** Stable contract surfaces this capability exposes. */
  provides: z
    .object({
      ui: z.array(z.string()).default([]),
      api: z.array(z.string()).default([]),
      events: z.array(z.string()).default([]),
      jobs: z.array(z.string()).default([]),
      cli: z.array(z.string()).default([]),
    })
    .default({}),

  security: z
    .object({
      secrets: z.array(z.string()).default([]),
      privilegedActions: z.array(z.string()).default([]),
    })
    .default({}),

  /** Optional: capabilities that run local commands declare their profiles. */
  launchProfiles: z.array(LaunchProfileSchema).optional(),

  diagnostics: z
    .object({
      healthChecks: z.array(HealthCheckSchema).default([]),
      runbook: z.string().optional(),
    })
    .default({}),
});

export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;
export type LaunchProfile = z.infer<typeof LaunchProfileSchema>;

/** Parse + validate a raw manifest object (e.g. from YAML). Throws on invalid. */
export function parseManifest(raw: unknown): CapabilityManifest {
  return CapabilityManifestSchema.parse(raw);
}

/** Non-throwing variant — returns the zod result for callers that want to report. */
export function safeParseManifest(raw: unknown) {
  return CapabilityManifestSchema.safeParse(raw);
}
