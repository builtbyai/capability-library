import * as React from 'react';
import type { SignatureSession } from '../../contracts/events.js';
import { AuditTrailViewer } from './AuditTrailViewer.js';

export interface SignatureReceiptProps {
  session: SignatureSession;
  onPrint?: () => void;
  onDownload?: () => void;
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'long' });
}

export function SignatureReceipt({ session, onPrint = () => window.print(), onDownload }: SignatureReceiptProps) {
  const c = session.contract;
  return (
    <div className="esig-card" id="esig-receipt-card">
      <div className="esig-receipt-header">
        <h2>Agreement Executed</h2>
        <div className="esig-receipt-ref">{c.ref}</div>
        <div className="esig-receipt-type">{c.type}</div>
      </div>

      <div className="esig-card-header esig-card-header-sub">
        <div className="esig-icon">📋</div>
        Key Terms
      </div>
      <table className="esig-terms-table">
        <tbody>
          {c.terms.map((row, i) => (
            <tr key={i}><td>{row[0]}</td><td>{row[1]}</td></tr>
          ))}
        </tbody>
      </table>

      <div className="esig-section">
        <div className="esig-card-header esig-card-header-sub">
          <div className="esig-icon">✎</div>
          Signatures
        </div>
        <div className="esig-sig-display-grid">
          {(['A', 'B'] as const).map((role) => {
            const sig = session.signatures[role];
            const party = session.parties.find((p) => p.role === role);
            return (
              <div className="esig-sig-display" key={role}>
                <div className="esig-sig-label">Party {role} — {party?.fullName ?? ''}</div>
                <div className="esig-sig-image-wrap">
                  {sig ? <img src={sig.dataUrl} alt={`Signature of ${party?.fullName}`} /> : <span className="esig-empty-state">Not signed</span>}
                </div>
                {sig && (
                  <div className="esig-sig-meta">
                    Signed: {formatTs(sig.timestamp)}
                    <div className="esig-hash-display">SHA-256: {sig.hash}</div>
                    <div className="esig-sig-ip">IP: {sig.ip}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AuditTrailViewer entries={session.audit} />

      <div className="esig-legal-disclaimer">
        <strong>Legal Notice:</strong> This document was signed electronically in compliance with the Electronic
        Signatures in Global and National Commerce Act (ESIGN Act, 15 U.S.C. § 7001) and the Texas Uniform Electronic
        Transactions Act (Tex. Bus. &amp; Com. Code Ch. 322). All parties consented to electronic signing. SHA-256
        integrity hashes are provided for each signature. The audit trail above constitutes a complete record of the
        signing ceremony.
      </div>

      <div className="esig-btn-row">
        <button className="esig-btn esig-btn-outline" onClick={onPrint}>🖨 Print</button>
        <button className="esig-btn esig-btn-primary" onClick={onDownload ?? onPrint}>⬇ Download PDF</button>
      </div>
    </div>
  );
}
