/**
 * system-monitor contracts. CPU/RAM/network/storage telemetry + process manager +
 * service control. Consumes fleet-control.health per machine and emits semantic
 * alerts that notify routes to the appropriate audience/channel.
 */
import { z } from 'zod';

export const SysmonSeveritySchema = z.enum(['info', 'warn', 'critical']);
export type SysmonSeverity = z.infer<typeof SysmonSeveritySchema>;

export const SysmonAlertCpuSpikeEvent = z.object({
  event: z.literal('sysmon.alert.cpu-spike'),
  hostId: z.string(),
  cpuPct: z.number().min(0).max(100),
  windowSeconds: z.number().int().positive(),
  thresholdPct: z.number().min(0).max(100),
  severity: SysmonSeveritySchema,
  at: z.string().datetime(),
});
export type SysmonAlertCpuSpike = z.infer<typeof SysmonAlertCpuSpikeEvent>;

export const SysmonAlertMemoryPressureEvent = z.object({
  event: z.literal('sysmon.alert.memory-pressure'),
  hostId: z.string(),
  usedPct: z.number().min(0).max(100),
  availableBytes: z.number().int().nonnegative(),
  thresholdPct: z.number().min(0).max(100),
  severity: SysmonSeveritySchema,
  at: z.string().datetime(),
});
export type SysmonAlertMemoryPressure = z.infer<typeof SysmonAlertMemoryPressureEvent>;

export const SysmonAlertDiskFullEvent = z.object({
  event: z.literal('sysmon.alert.disk-full'),
  hostId: z.string(),
  mountPath: z.string(),
  usedPct: z.number().min(0).max(100),
  freeBytes: z.number().int().nonnegative(),
  thresholdPct: z.number().min(0).max(100),
  severity: SysmonSeveritySchema,
  at: z.string().datetime(),
});
export type SysmonAlertDiskFull = z.infer<typeof SysmonAlertDiskFullEvent>;

export const SysmonProcessKilledEvent = z.object({
  event: z.literal('sysmon.process.killed'),
  hostId: z.string(),
  pid: z.number().int().positive(),
  name: z.string().optional(),
  signal: z.string().default('SIGTERM'),
  initiator: z.string(),
  at: z.string().datetime(),
});
export type SysmonProcessKilled = z.infer<typeof SysmonProcessKilledEvent>;

export const SysmonServiceRestartedEvent = z.object({
  event: z.literal('sysmon.service.restarted'),
  hostId: z.string(),
  serviceName: z.string(),
  previousStatus: z.string().optional(),
  initiator: z.string(),
  success: z.boolean(),
  at: z.string().datetime(),
});
export type SysmonServiceRestarted = z.infer<typeof SysmonServiceRestartedEvent>;

export const EVENT_NAMES = {
  alertCpuSpike: 'sysmon.alert.cpu-spike',
  alertMemoryPressure: 'sysmon.alert.memory-pressure',
  alertDiskFull: 'sysmon.alert.disk-full',
  processKilled: 'sysmon.process.killed',
  serviceRestarted: 'sysmon.service.restarted',
} as const;
