/**
 * connector-config contracts. Owns the connection registry + encrypted secret
 * store. Other capabilities (email-connector, knowledge-index, geo-visualization)
 * register their connector types here at boot.
 */
import { z } from 'zod';

export const ConnectorTypeSchema = z.enum([
  'gmail', 'imap', 'smtp', 'cloudflare', 'cloudflare-vectorize',
  'google_maps', 'google_earth', 'filesystem', 'r2', 'custom_api'
]);
export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;

export const ConnectorStatusSchema = z.enum(['unconfigured', 'healthy', 'degraded', 'failed']);
export type ConnectorStatus = z.infer<typeof ConnectorStatusSchema>;

export const ConnectorConfigSchema = z.object({
  connectorId: z.string().uuid(),
  type: ConnectorTypeSchema,
  displayName: z.string(),
  status: ConnectorStatusSchema,
  config: z.record(z.unknown()),
  secretRefs: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastTestedAt: z.string().optional(),
  lastTestDetail: z.string().optional(),
});
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;

export const ConnectorCreatedSchema       = ConnectorConfigSchema;
export const ConnectorTestedSchema        = z.object({ connectorId: z.string(), ok: z.boolean(), detail: z.string().optional(), at: z.string() });
export const ConnectorHealthChangedSchema = z.object({ connectorId: z.string(), from: ConnectorStatusSchema, to: ConnectorStatusSchema, at: z.string() });
export const ConnectorDeletedSchema       = z.object({ connectorId: z.string(), at: z.string() });
export const ConnectorSecretRotatedSchema = z.object({ connectorId: z.string(), secretRef: z.string(), at: z.string() });

export const EVENT_NAMES = {
  created: 'connector.created',
  tested:  'connector.tested',
  healthChanged: 'connector.health.changed',
  deleted: 'connector.deleted',
  rotated: 'connector.secret.rotated',
} as const;

export interface ConnectorTypeRegistration<TConfig = unknown, TSecrets = unknown> {
  type: ConnectorType;
  label: string;
  configSchema: z.ZodSchema<TConfig>;
  secretsSchema: z.ZodSchema<TSecrets>;
  test: (input: { config: TConfig; secrets: TSecrets }) => Promise<{ ok: boolean; detail?: string }>;
  scopesRequested?: string[];
}

export interface ConnectorConfigPort {
  registerType(reg: ConnectorTypeRegistration): void;
  create(input: { type: ConnectorType; displayName: string; config: Record<string, unknown>; secrets: Record<string, unknown> }): Promise<ConnectorConfig>;
  list(): Promise<ConnectorConfig[]>;
  get(connectorId: string): Promise<ConnectorConfig | null>;
  test(connectorId: string): Promise<{ ok: boolean; detail?: string }>;
  delete(connectorId: string): Promise<void>;
  resolveSecret(secretRef: string): Promise<string>;
}
