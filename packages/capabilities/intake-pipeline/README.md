# intake-pipeline  ·  _planned_

The universal front door. Everything external becomes one canonical record, then
routes by MIME type — so import logic is written once.

**Surfaces:** IntakeDropzone, IntakeFeed
**Emits:** `intake.object.received`

**Canonical event + routing:**
```ts
type IntakeObjectReceived = {
  event: 'intake.object.received';
  objectId: string;
  source: 'manual_upload' | 'gmail' | 'imap' | 'folder_watch' | 'url' | 'api';
  filename?: string; mimeType?: string; contentHash: string; storageUri: string;
  receivedAt: string;
};
```
```
application/pdf       → document-ingestion
image/*               → media-processing
application/vnd.kml   → geo-visualization
message/rfc822        → email-connector
text/html (clip)      → web-clipper / document-ingestion
```

**Boundary rule:** intake preserves the immutable original and assigns the id +
hash; it does not extract or transform. Downstream capabilities subscribe by MIME.
