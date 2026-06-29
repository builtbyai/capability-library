/**
 * UploadZone — a drag-and-drop + click-to-browse file intake surface. Emits the
 * selected File[] to the host (which routes them into intake-pipeline). Holds
 * only local hover state; no backend coupling.
 */
import { useCallback, useRef, useState, type CSSProperties, type DragEvent } from 'react';

export interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
}

export function UploadZone({
  onFiles,
  accept,
  multiple = true,
  label = 'Drop files here, or click to browse',
}: UploadZoneProps): JSX.Element {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setOver(false);
      if (e.dataTransfer) onFiles(Array.from(e.dataTransfer.files));
    },
    [onFiles],
  );

  const wrap: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
    padding: 16,
    borderRadius: 10,
    border: `2px dashed ${over ? '#4c8dff' : '#c9ced9'}`,
    background: over ? 'rgba(76,141,255,0.08)' : 'transparent',
    color: '#6b7280',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'border-color .12s, background .12s',
  };

  return (
    <div
      style={wrap}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
        }}
      />
      {label}
    </div>
  );
}
