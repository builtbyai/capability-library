/**
 * CommandProposalChip — renders an AI-proposed shell command with Run / Dismiss
 * actions. Generalized from the local-agent-terminal proposal chips so any
 * capability that suggests a command can reuse the surface. Stateless.
 */
import type { CSSProperties } from 'react';

export interface CommandProposal {
  id: string;
  command: string;
  rationale?: string;
}

export interface CommandProposalChipProps {
  proposal: CommandProposal;
  onRun: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function CommandProposalChip({ proposal, onRun, onDismiss }: CommandProposalChipProps): JSX.Element {
  const wrap: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 6px 4px 10px',
    borderRadius: 8,
    background: 'rgba(76,141,255,0.10)',
    border: '1px solid rgba(76,141,255,0.35)',
    fontSize: 12,
  };
  const code: CSSProperties = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', color: '#0b3a8a' };
  const btn: CSSProperties = { cursor: 'pointer', border: 'none', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 };
  return (
    <span style={wrap} title={proposal.rationale}>
      <code style={code}>{proposal.command}</code>
      <button style={{ ...btn, background: '#4c8dff', color: '#fff' }} onClick={() => onRun(proposal.id)}>
        Run
      </button>
      <button style={{ ...btn, background: 'transparent', color: '#6b7280' }} onClick={() => onDismiss(proposal.id)}>
        ✕
      </button>
    </span>
  );
}
