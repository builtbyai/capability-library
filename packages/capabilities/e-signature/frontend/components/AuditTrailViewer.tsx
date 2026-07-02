import * as React from 'react';
import type { AuditEntry } from '../../contracts/events.js';

export interface AuditTrailViewerProps {
  entries: AuditEntry[];
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'long' });
}

export function AuditTrailViewer({ entries }: AuditTrailViewerProps) {
  return (
    <div className="esig-audit-trail">
      <h3>Audit Trail</h3>
      {entries.map((entry, i) => (
        <div className="esig-audit-item" key={i}>
          <div className="esig-audit-time">{formatTs(entry.time)}</div>
          <div className="esig-audit-action">
            {entry.description}
            <br />
            <span className="esig-audit-ip">IP: {entry.ip}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
