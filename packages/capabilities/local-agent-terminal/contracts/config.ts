/**
 * The configuration schema this capability was missing in its original form.
 *
 * In the source dashboard, CLOUD_WS_BASE, the yolo path, PORT_RANGE_START, the
 * wrangler account_id, and the API secrets were scattered across five files.
 * Everything that must change on deploy now lives here and is imported by the
 * component, the backend, and the worker config.
 */
import { z } from 'zod';

export const LaunchProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  command: z.string(),
  riskLevel: z
    .enum([
      'normal',
      'external-ai-processing',
      'filesystem-write',
      'privileged',
    ])
    .default('normal'),
  requiresConfirmation: z.boolean().default(false),
  allowedWorkingDirectories: z.array(z.string()).optional(),
});

export const TerminalConfigSchema = z.object({
  /** Your worker URL — wss://<name>.<account>.workers.dev */
  cloudWsBase: z.string().url().or(z.string().startsWith('wss://')),

  /** Backend HTTP base for direct (LAN/localhost) mode. */
  backendUrl: z.string().default('http://localhost:5001'),

  /** Backend preferred port — only the instance that wins this port auto-starts the inline bridge. */
  preferredPort: z.number().default(5001),

  /** Standalone daemon /status port. */
  daemonStatusPort: z.number().default(5181),

  /** Idle reaper: kill a PTY with no listeners after this many ms (0 disables). */
  idleReaperMs: z.number().default(30 * 60 * 1000),

  /** Default shell when a profile doesn't specify one. */
  defaultShell: z.string().optional(),

  /** Launch profiles surfaced as buttons in the status bar. */
  launchProfiles: z.array(LaunchProfileSchema).default([]),

  /** localStorage keys (kept configurable so multiple dashboards can coexist). */
  storageKeys: z
    .object({
      apiToken: z.string().default('dashboard-api-token'),
      backendHost: z.string().default('dashboard-pty-backend-host'),
      sessionPrefix: z.string().default('dashboard-pty-session-'),
      lastCwd: z.string().default('terminal.pty.last-cwd'),
      recentCwds: z.string().default('terminal.pty.recent-cwds'),
    })
    .default({}),
});

export type TerminalConfig = z.infer<typeof TerminalConfigSchema>;
export type LaunchProfile = z.infer<typeof LaunchProfileSchema>;

/** A sensible default you can spread over and override per deploy. */
export const defaultTerminalConfig = (cloudWsBase: string): TerminalConfig =>
  TerminalConfigSchema.parse({
    cloudWsBase,
    launchProfiles: [
      {
        id: 'claude-yolo',
        label: '⚡ Claude (yolo)',
        command: 'claude --dangerously-skip-permissions',
        riskLevel: 'privileged',
        requiresConfirmation: true,
      },
      { id: 'claude-safe', label: 'Claude', command: 'claude', riskLevel: 'external-ai-processing' },
      { id: 'bash', label: 'Bash', command: 'bash', riskLevel: 'privileged', requiresConfirmation: true },
      { id: 'npm-dev', label: 'Dev', command: 'npm run dev', riskLevel: 'normal' },
    ],
  });
