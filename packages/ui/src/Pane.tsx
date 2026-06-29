/**
 * Pane — a titled container primitive for composing dashboard surfaces. Optional
 * header with a title + right-aligned actions slot. Stateless.
 */
import type { CSSProperties, ReactNode } from 'react';

export interface PaneProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}

export function Pane({ title, actions, children, style }: PaneProps): JSX.Element {
  const card: CSSProperties = {
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.08)',
    background: '#fff',
    overflow: 'hidden',
    ...style,
  };
  const header: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    fontSize: 13,
    fontWeight: 600,
    color: '#1f2430',
  };
  const body: CSSProperties = { padding: 14 };
  return (
    <section style={card}>
      {(title || actions) && (
        <header style={header}>
          <span>{title}</span>
          {actions}
        </header>
      )}
      <div style={body}>{children}</div>
    </section>
  );
}
