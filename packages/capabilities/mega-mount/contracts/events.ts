/**
 * mega-mount contracts. Mount-state port for a Mega cloud drive surfaced via
 * rclone + MEGAcmd + WebDAV. The watchdog drives the hung/recovered transitions
 * so notify and fleet-control can react without polling the filesystem.
 */
import { z } from 'zod';

export const MountHostSchema = z.enum(['node-a', 'node-b', 'node-c']);
export type MountHost = z.infer<typeof MountHostSchema>;

export const MegaMountStartedEvent = z.object({
  event: z.literal('mega.mount.started'),
  host: MountHostSchema,
  /** Drive letter or POSIX path the mount landed on (Y:, /mnt/mega). */
  mountPoint: z.string(),
  /** Local port the WebDAV bridge is listening on. */
  webdavPort: z.number().int().positive(),
  /** Linux pid of rclone / Windows pid of the rclone host process. */
  pid: z.number().int().positive().optional(),
  at: z.string().datetime(),
});
export type MegaMountStarted = z.infer<typeof MegaMountStartedEvent>;

export const MegaMountStoppedEvent = z.object({
  event: z.literal('mega.mount.stopped'),
  host: MountHostSchema,
  mountPoint: z.string(),
  reason: z.enum(['operator', 'watchdog', 'shutdown', 'crash']),
  at: z.string().datetime(),
});
export type MegaMountStopped = z.infer<typeof MegaMountStoppedEvent>;

export const MegaMountHungEvent = z.object({
  event: z.literal('mega.mount.hung'),
  host: MountHostSchema,
  mountPoint: z.string(),
  /** How the watchdog detected the hang. */
  detectedBy: z.enum(['stat-timeout', 'webdav-ping', 'readdir-timeout']),
  /** Wall ms the failing probe took before being abandoned. */
  probeMs: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type MegaMountHung = z.infer<typeof MegaMountHungEvent>;

export const MegaMountRecoveredEvent = z.object({
  event: z.literal('mega.mount.recovered'),
  host: MountHostSchema,
  mountPoint: z.string(),
  /** Action that brought the mount back. */
  action: z.enum(['restart-rclone', 'restart-webdav', 'remount', 'no-op']),
  wallMs: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type MegaMountRecovered = z.infer<typeof MegaMountRecoveredEvent>;

export const EVENT_NAMES = {
  mountStarted: 'mega.mount.started',
  mountStopped: 'mega.mount.stopped',
  mountHung: 'mega.mount.hung',
  mountRecovered: 'mega.mount.recovered',
} as const;
