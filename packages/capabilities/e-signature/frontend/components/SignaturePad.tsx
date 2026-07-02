import * as React from 'react';
import { TypedSignature, renderTypedToPng } from './TypedSignature.js';
import { DrawnSignature } from './DrawnSignature.js';
import { useSignatureCanvas } from '../hooks/useSignatureCanvas.js';
import { sha256Hex } from '../hooks/useESignatureState.js';
import type { Party, SignatureRecord, SignatureFontName, SignatureMode } from '../../contracts/events.js';

export interface SignaturePadProps {
  party: Party;
  /** Counter-party signed indicator (for Party B's step where A is already signed). */
  counterpartySignedLabel?: string;
  clientIp: string;
  onBack: () => void;
  onConfirm: (signature: SignatureRecord) => void;
}

export function SignaturePad({ party, counterpartySignedLabel, clientIp, onBack, onConfirm }: SignaturePadProps) {
  const [mode, setMode] = React.useState<SignatureMode>('type');
  const [typedValue, setTypedValue] = React.useState('');
  const [font, setFont] = React.useState<SignatureFontName>('Dancing Script');
  const [consented, setConsented] = React.useState(false);
  const canvas = useSignatureCanvas();

  const hasSig = mode === 'type' ? typedValue.trim().length > 0 : !canvas.isEmpty;
  const canConfirm = consented && hasSig;

  const handleConfirm = React.useCallback(async () => {
    const dataUrl = mode === 'type'
      ? renderTypedToPng(typedValue.trim(), font)
      : canvas.exportPng();
    const hash = await sha256Hex(dataUrl);
    const record: SignatureRecord = {
      role: party.role,
      mode,
      dataUrl,
      hash,
      timestamp: new Date().toISOString(),
      ip: clientIp,
      userAgent: navigator.userAgent,
      meta: mode === 'type'
        ? { mode: 'type', fontName: font }
        : { mode: 'draw', color: canvas.color, thickness: canvas.thickness },
    };
    onConfirm(record);
  }, [mode, typedValue, font, canvas, party.role, clientIp, onConfirm]);

  return (
    <div className="esig-card">
      {counterpartySignedLabel && (
        <>
          <div className="esig-counterparty-row">
            <div className="esig-counterparty-label">{counterpartySignedLabel}</div>
            <div className="esig-signed-indicator">Signed</div>
          </div>
          <hr className="esig-divider" />
        </>
      )}

      <div className="esig-card-header">
        <div className="esig-icon">✎</div>
        Party {party.role} Signature — {party.fullName}
      </div>

      <div className="esig-form-grid-2">
        <div className="esig-form-group">
          <label className="esig-form-label">Full Name</label>
          <input className="esig-form-input" value={party.fullName} readOnly />
        </div>
        {party.company && (
          <div className="esig-form-group">
            <label className="esig-form-label">Company</label>
            <input className="esig-form-input" value={party.company} readOnly />
          </div>
        )}
      </div>

      <div className="esig-sig-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`esig-sig-tab ${mode === 'type' ? 'active' : ''}`}
          onClick={() => setMode('type')}
        >
          Type Signature
        </button>
        <button
          type="button"
          role="tab"
          className={`esig-sig-tab ${mode === 'draw' ? 'active' : ''}`}
          onClick={() => setMode('draw')}
        >
          Draw Signature
        </button>
      </div>

      <div style={{ display: mode === 'type' ? 'block' : 'none' }}>
        <TypedSignature
          value={typedValue}
          fontName={font}
          onChange={setTypedValue}
          onFontChange={setFont}
          placeholder={party.fullName}
        />
      </div>
      <div style={{ display: mode === 'draw' ? 'block' : 'none' }}>
        <DrawnSignature canvas={canvas} />
      </div>

      <div className="esig-checkbox-row">
        <input
          type="checkbox"
          id={`esig-sig-consent-${party.role}`}
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
        />
        <label htmlFor={`esig-sig-consent-${party.role}`}>
          I, {party.fullName}, confirm this is my electronic signature and I agree to the terms of the selected agreement.
        </label>
      </div>

      <div className="esig-btn-row">
        <button className="esig-btn esig-btn-outline" onClick={onBack}>← Back</button>
        <button className="esig-btn esig-btn-primary" disabled={!canConfirm} onClick={handleConfirm}>
          Confirm Signature →
        </button>
      </div>
    </div>
  );
}
