/**
 * Magic-byte MIME sniffer. Never trust the upstream Content-Type header —
 * bulk-media-import documented the failure mode where RoofLink's SPA returned
 * HTML with HTTP 200 + `Content-Type: image/jpeg`. Always re-sniff bytes.
 *
 * Implementation note: this is a minimal table for the most common types the
 * library deals with. For exhaustive coverage, wrap `file-type` from npm —
 * but the dep isn't required at the core layer; capabilities can extend.
 */

export interface SniffResult {
  mime: string;
  ext: string;
}

interface MagicEntry {
  mime: string;
  ext: string;
  offset?: number;
  signature: number[];
}

const MAGIC: MagicEntry[] = [
  // PDFs
  { mime: 'application/pdf', ext: 'pdf', signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  // PNG
  { mime: 'image/png', ext: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // JPEG
  { mime: 'image/jpeg', ext: 'jpg', signature: [0xff, 0xd8, 0xff] },
  // GIF
  { mime: 'image/gif', ext: 'gif', signature: [0x47, 0x49, 0x46, 0x38] },
  // WebP (RIFF....WEBP)
  { mime: 'image/webp', ext: 'webp', offset: 8, signature: [0x57, 0x45, 0x42, 0x50] },
  // ZIP (also DOCX/XLSX/PPTX/KMZ/JAR/EPUB; bag-of-formats — caller may refine)
  { mime: 'application/zip', ext: 'zip', signature: [0x50, 0x4b, 0x03, 0x04] },
  // KML (text/xml — sniff via first bytes only loosely)
  { mime: 'application/vnd.google-earth.kml+xml', ext: 'kml', signature: [0x3c, 0x3f, 0x78, 0x6d, 0x6c] }, // <?xml
  // HTML
  { mime: 'text/html', ext: 'html', signature: [0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45] }, // <!DOCTYPE
  // MP4 (ftyp at offset 4)
  { mime: 'video/mp4', ext: 'mp4', offset: 4, signature: [0x66, 0x74, 0x79, 0x70] },
];

export function sniffMime(headBytes: Uint8Array): SniffResult | null {
  for (const m of MAGIC) {
    const off = m.offset ?? 0;
    if (headBytes.length < off + m.signature.length) continue;
    let match = true;
    for (let i = 0; i < m.signature.length; i++) {
      if (headBytes[off + i] !== m.signature[i]) {
        match = false;
        break;
      }
    }
    if (match) return { mime: m.mime, ext: m.ext };
  }
  return null;
}
