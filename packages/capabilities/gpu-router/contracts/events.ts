/**
 * gpu-router contracts. One snapshot shape across NVIDIA + AMD; routing
 * decisions are observable + attributable.
 */
import { z } from 'zod';
// Local copy to avoid cross-capability contracts coupling. The canonical
// FleetHost shape lives in fleet-control; this string-form is the routing
// surface gpu-router actually uses (host identifier only).
const FleetHostSchema = z.string();
export type FleetHost = z.infer<typeof FleetHostSchema>;

export const GpuVendorSchema = z.enum(['nvidia', 'amd', 'apple', 'intel']);

export const GpuSnapshotSchema = z.object({
  host: FleetHostSchema,
  gpuIndex: z.number().int().nonnegative(),
  vendor: GpuVendorSchema,
  model: z.string(),
  vramTotalMb: z.number().int().positive(),
  vramUsedMb: z.number().int().nonnegative(),
  utilizationPct: z.number().min(0).max(100),
  /** Inflight Ollama models keep_alive'd here. */
  loadedModels: z.array(z.string()).default([]),
  /** Estimated queue depth (ollama queued requests). */
  queueDepth: z.number().int().nonnegative().default(0),
  temperatureC: z.number().optional(),
  collectedAt: z.string().datetime(),
});
export type GpuSnapshot = z.infer<typeof GpuSnapshotSchema>;

export const GpuRouteRequestSchema = z.object({
  /** Workload kind helps the router pick (vision model wants more VRAM; small chat wants lowest queue). */
  workload: z.enum(['inference-small', 'inference-large', 'inference-vision', 'transcode-encode', 'transcode-decode']),
  /** Estimated VRAM needed (MB). Router rejects hosts with insufficient free VRAM. */
  vramRequiredMb: z.number().int().positive(),
  /** Optional model id — router prefers hosts that already have it loaded (no cold-load). */
  modelId: z.string().optional(),
  /** Vendor restriction (e.g. CUDA-only workloads exclude AMD). */
  requireVendor: GpuVendorSchema.optional(),
  capabilityId: z.string(),
});
export type GpuRouteRequest = z.infer<typeof GpuRouteRequestSchema>;

export const GpuRouteDecisionSchema = z.object({
  routeId: z.string().uuid(),
  request: GpuRouteRequestSchema,
  /** Selected host + GPU index. null = no host satisfies the request. */
  selectedHost: FleetHostSchema.nullable(),
  selectedGpuIndex: z.number().int().nullable(),
  /** Reason for the selection (or rejection). */
  reason: z.string(),
  routedAt: z.string().datetime(),
});

export const GpuSnapshotEvent       = z.object({ event: z.literal('gpu.snapshot'), snapshots: z.array(GpuSnapshotSchema), at: z.string() });
export const GpuRoutedEvent         = z.object({ event: z.literal('gpu.routed'), decision: GpuRouteDecisionSchema });
export const GpuHostOverloadedEvent = z.object({ event: z.literal('gpu.host.overloaded'), host: FleetHostSchema, vramPctUsed: z.number(), queueDepth: z.number().int(), at: z.string() });

export const EVENT_NAMES = {
  snapshot: 'gpu.snapshot',
  routed: 'gpu.routed',
  overloaded: 'gpu.host.overloaded',
} as const;

export interface GpuRouterPort {
  snapshot(): Promise<GpuSnapshot[]>;
  route(req: GpuRouteRequest): Promise<{ host: FleetHost; gpuIndex: number; routeId: string } | null>;
  rebalance(): Promise<{ moved: number }>;
}
