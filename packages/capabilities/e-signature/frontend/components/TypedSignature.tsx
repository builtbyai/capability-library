import * as React from 'react';
import { SIGNATURE_FONTS, type SignatureFontName } from '../../contracts/events.js';

export interface TypedSignatureProps {
  value: string;
  fontName: SignatureFontName;
  onChange: (value: string) => void;
  onFontChange: (font: SignatureFontName) => void;
  placeholder?: string;
}

export function TypedSignature({ value, fontName, onChange, onFontChange, placeholder = '' }: TypedSignatureProps) {
  const activeFont = SIGNATURE_FONTS.find((f) => f.name === fontName) ?? SIGNATURE_FONTS[0];

  return (
    <div className="esig-sig-type-area">
      <div className="esig-form-group">
        <label className="esig-form-label">Type your name</label>
        <input
          className="esig-form-input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <div className={`esig-sig-preview ${value.trim() ? '' : 'empty'}`}>
        {value.trim()
          ? <span style={{ fontFamily: activeFont.family, fontSize: '42px' }}>{value}</span>
          : <span>Type your name above…</span>
        }
      </div>

      <div className="esig-font-picker">
        {SIGNATURE_FONTS.map((f) => (
          <button
            key={f.name}
            className={`esig-font-pill ${f.name === fontName ? 'active' : ''}`}
            style={{ fontFamily: f.family }}
            onClick={() => onFontChange(f.name)}
            type="button"
          >
            {f.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Render a typed signature to a PNG data URL for receipt embedding. */
export function renderTypedToPng(text: string, fontName: SignatureFontName): string {
  const font = SIGNATURE_FONTS.find((f) => f.name === fontName) ?? SIGNATURE_FONTS[0];
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 120;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 600, 120);
  ctx.fillStyle = '#1A1A1A';
  ctx.font = `48px ${font.family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 300, 60);
  return c.toDataURL('image/png');
}
