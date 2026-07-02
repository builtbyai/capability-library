import * as React from 'react';
import type { UseSignatureCanvasResult, PenColor, PenThickness } from '../hooks/useSignatureCanvas.js';

const PEN_COLORS: PenColor[] = ['#1A1A1A', '#1B3A6B', '#2B5C9E'];
const PEN_THICKNESSES: Array<{ value: PenThickness; label: string }> = [
  { value: 2, label: 'Thin' },
  { value: 3, label: 'Medium' },
  { value: 5, label: 'Thick' },
];

export interface DrawnSignatureProps {
  canvas: UseSignatureCanvasResult;
}

export function DrawnSignature({ canvas }: DrawnSignatureProps) {
  return (
    <div className="esig-sig-draw-area">
      <div className="esig-canvas-wrap">
        <canvas className="esig-sig-canvas" ref={canvas.canvasRef} />
      </div>
      <div className="esig-draw-controls">
        <div className="esig-control-group">
          <span className="esig-control-label">Color:</span>
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`esig-color-btn ${canvas.color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => canvas.setColor(c)}
              aria-label={`Pen color ${c}`}
            />
          ))}
        </div>
        <div className="esig-control-group">
          <span className="esig-control-label">Size:</span>
          {PEN_THICKNESSES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`esig-thickness-btn ${canvas.thickness === t.value ? 'active' : ''}`}
              onClick={() => canvas.setThickness(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="esig-draw-action-btns">
          <button type="button" className="esig-draw-action-btn" onClick={canvas.undo} disabled={canvas.paths.length === 0}>
            ↶ Undo
          </button>
          <button type="button" className="esig-draw-action-btn" onClick={canvas.clear} disabled={canvas.isEmpty}>
            ✕ Clear
          </button>
        </div>
      </div>
    </div>
  );
}
