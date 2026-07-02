/**
 * cloudflare-deploy contracts. Deploy verification = hash the local build/ root
 * and compare against the deployed asset. Per user memory: wrangler will
 * silently upload a stale build/ if npm run build failed.
 */
import { z } from 'zod';

export const CfTargetKindSchema = z.enum(['pages', 'worker', 'd1', 'kv', 'r2', 'hyperdrive']);
export type CfTargetKind = z.infer<typeof CfTargetKindSchema>;

export const CfDeployRequestSchema = z.object({
  target: CfTargetKindSchema,
  projectName: z.string(),
  /** For pages: build directory. For worker: wrangler.toml path. */
  source: z.string(),
  branch: z.string().default('main'),
  /** Optional pre-deploy hooks (e.g. `npm run build`). */
  preDeployHooks: z.array(z.string()).default([]),
  /** Refuse deploy if `npm run build` exit code is non-zero. */
  refuseOnHookFailure: z.boolean().default(true),
});
export type CfDeployRequest = z.infer<typeof CfDeployRequestSchema>;

export const CfDeployResultSchema = z.object({
  deployId: z.string().uuid(),
  target: CfTargetKindSchema,
  projectName: z.string(),
  /** Cloudflare-assigned deployment URL (e.g. https://abc123.project.pages.dev). */
  deploymentUrl: z.string().url().optional(),
  /** sha256 of the local build root, recorded at deploy time. */
  localBundleHash: z.string().regex(/^[a-f0-9]{64}$/),
  /** sha256 of the live deployment (downloaded asset bytes). */
  liveBundleHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  hashMatch: z.boolean().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  exitCode: z.number().int().optional(),
});
export type CfDeployResult = z.infer<typeof CfDeployResultSchema>;

export const DeployRequestedEvent      = z.object({ event: z.literal('cf.deploy.requested'), request: CfDeployRequestSchema, at: z.string() });
export const DeployCompletedEvent      = z.object({ event: z.literal('cf.deploy.completed'), result: CfDeployResultSchema });
export const DeployFailedEvent         = z.object({ event: z.literal('cf.deploy.failed'), request: CfDeployRequestSchema, stage: z.enum(['pre-hook', 'wrangler', 'verify']), error: z.string() });
export const DeployHashVerifiedEvent   = z.object({ event: z.literal('cf.deploy.hash-verified'), deployId: z.string().uuid(), match: z.boolean(), localHash: z.string(), liveHash: z.string() });
export const RollbackCompletedEvent    = z.object({ event: z.literal('cf.rollback.completed'), fromDeployId: z.string().uuid(), toDeployId: z.string().uuid(), at: z.string() });

export const EVENT_NAMES = {
  requested: 'cf.deploy.requested',
  completed: 'cf.deploy.completed',
  failed: 'cf.deploy.failed',
  hashVerified: 'cf.deploy.hash-verified',
  rollbackCompleted: 'cf.rollback.completed',
} as const;

export interface CloudflareDeployPort {
  deployPages(req: CfDeployRequest): Promise<CfDeployResult>;
  deployWorker(req: CfDeployRequest): Promise<CfDeployResult>;
  migrateD1(input: { projectName: string; migrationFile: string }): Promise<{ deployId: string }>;
  rollback(deployId: string): Promise<{ rolledBackTo: string }>;
  verifyHash(deployId: string): Promise<{ match: boolean; localHash: string; liveHash: string }>;
  listDeploys(projectName: string, limit?: number): Promise<CfDeployResult[]>;
}
