import * as React from 'react';
import type { ContractDefinition } from '../../contracts/events.js';

export interface ContractSelectorProps {
  contracts: ContractDefinition[];
  selectedRef: string | null;
  onSelect: (c: ContractDefinition) => void;
  onContinue: () => void;
}

export function ContractSelector({ contracts, selectedRef, onSelect, onContinue }: ContractSelectorProps) {
  return (
    <div className="esig-card">
      <div className="esig-card-header">
        <div className="esig-icon">📄</div>
        Select Agreement
      </div>
      <p className="esig-card-subtle">Choose the contract to review and sign electronically.</p>
      <div className="esig-contract-grid">
        {contracts.map((c) => (
          <div
            key={c.ref}
            className={`esig-contract-card ${selectedRef === c.ref ? 'selected' : ''}`}
            onClick={() => onSelect(c)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(c); }}
          >
            <div className="esig-contract-ref">{c.ref}</div>
            <div className="esig-contract-title">{c.title}</div>
            <div className="esig-contract-value">{c.value}</div>
            <div className="esig-contract-scope-brief">{c.scope.slice(0, 2).join('. ')}.</div>
          </div>
        ))}
      </div>
      <div className="esig-btn-row">
        <button className="esig-btn esig-btn-primary" disabled={!selectedRef} onClick={onContinue}>
          Continue to Review →
        </button>
      </div>
    </div>
  );
}
