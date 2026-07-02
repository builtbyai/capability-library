import * as React from 'react';
import type { ContractDefinition, Party } from '../../contracts/events.js';

export interface TermsReviewProps {
  contract: ContractDefinition;
  parties: [Party, Party];
  consented: boolean;
  onConsentChange: (consented: boolean) => void;
  onBack: () => void;
  onProceed: () => void;
}

export function TermsReview({ contract, parties, consented, onConsentChange, onBack, onProceed }: TermsReviewProps) {
  return (
    <div className="esig-card">
      <div className="esig-card-header">
        <div className="esig-icon">📋</div>
        {contract.title} — Terms Review
      </div>

      <table className="esig-terms-table">
        <tbody>
          {contract.terms.map((row, i) => (
            <tr key={i}>
              <td>{row[0]}</td>
              <td>{row[1]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="esig-section">
        <div className="esig-card-header esig-card-header-sub">
          <div className="esig-icon">📚</div>
          Scope of Work
        </div>
        <ul className="esig-scope-list">
          {contract.scope.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="esig-party-grid">
        {parties.map((p) => (
          <div className="esig-party-box" key={p.role}>
            <div className="esig-party-label">Party {p.role} — {p.role === 'A' ? 'Provider' : 'Client'}</div>
            <div className="esig-party-name">{p.fullName}</div>
            {p.company && <div className="esig-party-company">{p.company}</div>}
            <div className="esig-party-detail">
              {p.address && <>{p.address}<br /></>}
              {p.phone && <>{p.phone}<br /></>}
              {p.email}
            </div>
          </div>
        ))}
      </div>

      <div className="esig-checkbox-row">
        <input
          type="checkbox"
          id="esig-consent-check"
          checked={consented}
          onChange={(e) => onConsentChange(e.target.checked)}
        />
        <label htmlFor="esig-consent-check">
          I consent to electronic signing in accordance with the ESIGN Act (15 U.S.C. § 7001) and the Texas Uniform
          Electronic Transactions Act (Bus. &amp; Com. Code Ch. 322). I understand that my electronic signature carries
          the same legal weight as a handwritten signature.
        </label>
      </div>

      <div className="esig-btn-row">
        <button className="esig-btn esig-btn-outline" onClick={onBack}>← Back</button>
        <button className="esig-btn esig-btn-primary" disabled={!consented} onClick={onProceed}>
          Proceed to Sign →
        </button>
      </div>
    </div>
  );
}
