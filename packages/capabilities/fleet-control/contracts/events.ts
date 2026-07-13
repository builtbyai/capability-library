/**
 * fleet-control contracts. The three-PC fleet (node-a, node-b, node-c) gets
 * one normalized shape: identity, health, services, GUI actions, metrics.
 */
import { z } from 'zod';

export const FleetHostSchema = z.enum(['node-a', 'node-b', 'node-c', 'pcb', 'pcc']);
export type FleetHost = z.infer<typeof FleetHostSchema>;

export const FleetOsSchema = z.enum(['windows', 'linux', 'macos']);

export const MachineIdentitySchema = z.object({
  host: FleetHostSchema,
  hostname: z.string(),
  os: FleetOsSchema,
  /** LAN address (primary). */
  ip: z.string(),
  /** Tailscale / direct-link address if present. */
  altAddresses: z.array(z.string()).default([]),
  /** Port-9900 stream server URL if reachable. */
  guiUrl: z.string().url().optional(),
  /** SSH alias (e.g. node-c, bbw, node-b, pcb). */
  sshAlias: z.string().optional(),
  /** GPU vendor/model (if any). */
  gpu: z.string().optional(),
  totalRamGb: z.number().int().optional(),
  detectedAt: z.string().datetime(),
});
export type MachineIdentity = z.infer<typeof MachineIdentitySchema>;

export const MachineHealthSchema = z.object({
  host: FleetHostSchema,
  ramPercentUsed: z.number().min(0).max(100),
  diskPercentUsed: z.number().min(0).max(100),
  cpuLoad1m: z.number().nonnegative(),
  uptimeSec: z.number().int().nonnegative(),
  ollamaReachable: z.boolean(),
  ollamaQueuedRequests: z.number().int().optional(),
  collectedAt: z.string().datetime(),
});
export type MachineHealth = z.infer<typeof MachineHealthSchema>;

export const ServiceStatusSchema = z.object({
  host: FleetHostSchema,
  /** Service identifier (Windows scheduled task id, systemd unit name, NSSM service name). */
  serviceId: z.string(),
  state: z.enum(['running', 'stopped', 'failed', 'unknown']),
  lastStartedAt: z.string().datetime().optional(),
  restartCount: z.number().int().nonnegative().default(0),
});
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const GuiActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('screenshot') }),
  z.object({ kind: z.literal('click'), x: z.number().int(), y: z.number().int(), button: z.enum(['left','right','middle']).default('left') }),
  z.object({ kind: z.literal('type'), text: z.string() }),
  z.object({ kind: z.literal('hotkey'), keys: z.string() }),
  z.object({ kind: z.literal('scroll'), x: z.number().int(), y: z.number().int(), dy: z.number().int() }),
]);
export type GuiAction = z.infer<typeof GuiActionSchema>;

export const MachineUnreachableEvent  = z.object({ event: z.literal('fleet.machine.unreachable'), host: FleetHostSchema, lastSeenAt: z.string(), at: z.string() });
export const MachineRecoveredEvent    = z.object({ event: z.literal('fleet.machine.recovered'), host: FleetHostSchema, downtimeMs: z.number().int(), at: z.string() });
export const ServiceFailedEvent       = z.object({ event: z.literal('fleet.service.failed'), host: FleetHostSchema, serviceId: z.string(), at: z.string() });
export const GuiActionCompletedEvent  = z.object({ event: z.literal('fleet.gui.action.completed'), host: FleetHostSchema, action: GuiActionSchema, durationMs: z.number().int(), at: z.string() });
export const FleetMetricsSnapshotEvent= z.object({ event: z.literal('fleet.metrics.snapshot'), snapshot: z.array(MachineHealthSchema), at: z.string() });

export const EVENT_NAMES = {
  machineUnreachable: 'fleet.machine.unreachable',
  machineRecovered: 'fleet.machine.recovered',
  serviceFailed: 'fleet.service.failed',
  guiActionCompleted: 'fleet.gui.action.completed',
  metricsSnapshot: 'fleet.metrics.snapshot',
} as const;

export interface FleetControlPort {
  listMachines(): Promise<MachineIdentity[]>;
  getIdentity(host: FleetHost): Promise<MachineIdentity>;
  getHealth(host: FleetHost): Promise<MachineHealth>;
  listServices(host: FleetHost): Promise<ServiceStatus[]>;
  dispatchGuiAction(host: FleetHost, action: GuiAction): Promise<{ ok: boolean; result?: unknown }>;
  restartService(host: FleetHost, serviceId: string): Promise<{ ok: boolean }>;
}
