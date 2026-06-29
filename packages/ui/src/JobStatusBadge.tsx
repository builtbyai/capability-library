/**
 * JobStatusBadge — renders a job's lifecycle state as a colored pill.
 * Mirrors StatusBadge but for the core JobState vocabulary. Stateless, inline
 * styles, no backend coupling (JobLifecycle is declared locally so @multimarcdown/ui
 * stays dependency-free).
 */
import type { CSSProperties } from 'react';

export type JobLifecycle = 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';

export interface JobStatusBadgeProps {
  state: JobLifecycle;
  label?: string;
}

const palette: Record<JobLifecycle, { dot: string; fg: string; bg: string }> = {
  queued: { dot: '#9aa1b2', fg: '#3a3f4b', bg: 'rgba(154,161,178,0.16)' },
  running: { dot: '#4c8dff', fg: '#0b3a8a', bg: 'rgba(76,141,255,0.16)' },
  waiting: { dot: '#f5c542', fg: '#6b4e00', bg: 'rgba(245,197,66,0.16)' },
  completed: { dot: '#36d399', fg: '#0c5132', bg: 'rgba(54,211,153,0.16)' },
  failed: { dot: '#ff5d5d', fg: '#7a1212', bg: 'rgba(255,93,93,0.16)' },
  cancelled: { dot: '#c0863b', fg: '#5a3a06', bg: 'rgba(192,134,59,0.16)' },
};

export function JobStatusBadge({ state, label }: JobStatusBadgeProps): JSX.Element {
  const c = palette[state];
  const wrap: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 9px',
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.6,
  };
  const dot: CSSProperties = { width: 7, height: 7, borderRadius: '50%', background: c.dot };
  return (
    <span style={wrap} title={state}>
      <span style={dot} />
      {label ?? state}
    </span>
  );
}
