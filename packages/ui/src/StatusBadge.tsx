/**
 * StatusBadge — a tiny presentational component that renders a capability's
 * HealthState. It's intentionally dependency-light (inline styles) so any
 * capability can use it without pulling in a CSS pipeline.
 *
 * This is the "narrow component library" layer: visual, stateless, reusable.
 */
import type { CSSProperties } from 'react';

export type HealthState = 'healthy' | 'degraded' | 'failed' | 'unknown';

export interface StatusBadgeProps {
  state: HealthState;
  label?: string;
  title?: string;
}

const palette: Record<HealthState, { dot: string; fg: string; bg: string }> = {
  healthy: { dot: '#36d399', fg: '#0c5132', bg: 'rgba(54,211,153,0.16)' },
  degraded: { dot: '#f5c542', fg: '#6b4e00', bg: 'rgba(245,197,66,0.16)' },
  failed: { dot: '#ff5d5d', fg: '#7a1212', bg: 'rgba(255,93,93,0.16)' },
  unknown: { dot: '#9aa1b2', fg: '#3a3f4b', bg: 'rgba(154,161,178,0.16)' },
};

export function StatusBadge({ state, label, title }: StatusBadgeProps): JSX.Element {
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
    <span style={wrap} title={title ?? state}>
      <span style={dot} />
      {label ?? state}
    </span>
  );
}
