/**
 * ai-orchestration contracts. One run = one strategy + one prompt → multiple
 * angle/agent outputs → one synthesized result.
 */
import { z } from 'zod';

export const OrchStrategySchema = z.enum([
  'parallel-think',
  'parallel-agent-synthesis',
  'devils-advocate',
  'multi-model-consensus',
]);
export type OrchStrategy = z.infer<typeof OrchStrategySchema>;

export const OrchRequestSchema = z.object({
  strategy: OrchStrategySchema,
  prompt: z.string().min(1),
  /** How many parallel angles/agents to spawn. */
  fanout: z.number().int().min(1).max(8).default(3),
  /** Optional per-strategy hints. */
  angles: z.array(z.string()).optional(),       // for parallel-think
  agents: z.array(z.string()).optional(),       // for parallel-agent-synthesis
  models: z.array(z.string()).optional(),       // for multi-model-consensus
  capabilityId: z.string(),                     // caller cap (for cost-ledger attribution)
  /** Optional config for the judge step. */
  judge: z.object({ model: z.string().optional(), mode: z.enum(['merge', 'pick-best', 'critique']).default('merge') }).optional(),
});
export type OrchRequest = z.infer<typeof OrchRequestSchema>;

export const OrchAngleResultSchema = z.object({
  angleId: z.string().uuid(),
  runId: z.string().uuid(),
  /** Position in the fanout (0-based). */
  index: z.number().int().nonnegative(),
  /** The label given to this angle/agent (e.g. 'adversarial', 'first-principles'). */
  label: z.string(),
  /** The model that produced this output (e.g. 'deepseek-v4-flash'). */
  provider: z.string(),
  text: z.string(),
  costUSD: z.number().nonnegative().optional(),
  wallMs: z.number().int().nonnegative(),
});
export type OrchAngleResult = z.infer<typeof OrchAngleResultSchema>;

export const OrchSynthesisSchema = z.object({
  runId: z.string().uuid(),
  text: z.string(),
  /** Which angles contributed to the final synthesis. */
  contributors: z.array(z.string()),
  /** Judge model used. */
  judgeProvider: z.string(),
  costUSD: z.number().nonnegative().optional(),
});

export const OrchRunStartedEvent       = z.object({ event: z.literal('orch.run.started'), runId: z.string().uuid(), request: OrchRequestSchema, at: z.string() });
export const OrchAngleCompletedEvent   = z.object({ event: z.literal('orch.angle.completed'), angle: OrchAngleResultSchema });
export const OrchSynthesisCompletedEvent = z.object({ event: z.literal('orch.synthesis.completed'), synthesis: OrchSynthesisSchema });
export const OrchRunCompletedEvent     = z.object({ event: z.literal('orch.run.completed'), runId: z.string().uuid(), totalCostUSD: z.number().nonnegative().optional(), totalWallMs: z.number().int().nonnegative() });
export const OrchRunFailedEvent        = z.object({ event: z.literal('orch.run.failed'), runId: z.string().uuid(), reason: z.string() });

export const EVENT_NAMES = {
  runStarted: 'orch.run.started',
  angleCompleted: 'orch.angle.completed',
  synthesisCompleted: 'orch.synthesis.completed',
  runCompleted: 'orch.run.completed',
  runFailed: 'orch.run.failed',
} as const;

export interface AiOrchestrationPort {
  parallelThink(req: OrchRequest): Promise<{ runId: string; angles: OrchAngleResult[]; synthesis: string }>;
  parallelSynthesis(req: OrchRequest): Promise<{ runId: string; angles: OrchAngleResult[]; synthesis: string }>;
  devilsAdvocate(req: OrchRequest): Promise<{ runId: string; original: string; critique: string }>;
  multiModelConsensus(req: OrchRequest): Promise<{ runId: string; perModel: Record<string, string>; consensus: string }>;
}
