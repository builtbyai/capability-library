/**
 * Stage 1: paste into the source app's browser DevTools console.
 * Required: user is logged into the source app and has a session token
 * accessible via JS (e.g. localStorage.sid for RoofLink).
 *
 * Background (sharp edges proven by 2026-06-22 RoofLink migration):
 *   - Source apps often patch window.fetch for analytics. The wrapper crashes
 *     on opaque cross-origin S3 responses with
 *     "TypeError: Cannot read properties of undefined (reading 'clone')".
 *     Use XMLHttpRequest with responseType='arraybuffer' instead.
 *   - Field names matter. RoofLink: photo.preview_url (NOT photo.preview),
 *     photo.url for original. A typo silently fetches the SPA's index.html
 *     and writes 2546 bytes of HTML masquerading as your image bytes.
 *     ALWAYS spot-check: file size > 5KB and first 4 bytes = JPEG/PNG magic.
 *   - Chrome throttles background tabs heavily (~1Hz setTimeout).
 *     Foreground the tab, OR pop it into its own window for parallel work.
 *   - Output redactors (claude-in-chrome) block URLs/cookies/JWT-shaped strings
 *     when echoing through the tool. Convert URLs to counts/keys for status reads.
 *
 * Usage (paste into DevTools console of the source app's tab):
 *   1. Paste this whole file
 *   2. Tune SOURCE_CONFIG below for your target source app
 *   3. window.__bulk = {state:'init', jobs:[]};
 *   4. (async () => { for (const id of JOB_IDS) {
 *        window.__bulk.jobs.push(await window.__scrapeFull(id));
 *      } })();
 *   5. When done, trigger download:
 *      const blob = new Blob([JSON.stringify({jobs: window.__bulk.jobs})], {type:'application/octet-stream'});
 *      const a = document.createElement('a');
 *      a.href = URL.createObjectURL(blob);
 *      a.download = 'bundle_' + Date.now() + '.json';
 *      document.body.appendChild(a); a.click();
 *
 *   Chrome will block multiple downloads after the first — click the pill
 *   in the URL bar to "Always allow downloads from <this site>".
 */

// ===== TUNE THESE FOR YOUR SOURCE APP =====
const SOURCE_CONFIG = {
  // RoofLink default. Replace for other sources.
  apiBase: 'https://api.roof.link/api/light',
  tokenStorage: () => localStorage.getItem('sid'),
  authHeader: (token) => ({
    Accept: 'application/json',
    Authorization: 'Bearer ' + token,
    'X-Platform-Version': 'light',
  }),
  photosListPath: (jobId, page) => `/photos/?job=${jobId}&page=${page}`,
  docsListPath: (jobId) => `/documents/?job=${jobId}`,
  // Field extractor — return whatever shape your scraper wants per photo
  extractPhoto: (p) => ({ n: p.name, id: p.id, p: p.preview_url, o: p.url, tags: p.tags, c: p.date_created }),
  extractDocUrl: (d) => d.url || d.file,
  extractDocMeta: (d) => ({ n: d.name, id: d.id, ext: d.ext, c: d.date_created }),
  maxPages: 30,
};

// ===== XHR-based byte fetcher (bypasses broken fetch wrappers) =====
window.__xhrBytes = (url) => new Promise((resolve, reject) => {
  const x = new XMLHttpRequest();
  x.open('GET', url, true);
  x.responseType = 'arraybuffer';
  x.timeout = 30000;
  x.onload = () => {
    if (x.status >= 200 && x.status < 300) {
      const ab = x.response;
      const b = new Uint8Array(ab);
      let s = '';
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      resolve({ len: ab.byteLength, mime: x.getResponseHeader('content-type') || '', b64: btoa(s) });
    } else reject(new Error('HTTP ' + x.status));
  };
  x.onerror = () => reject(new Error('network'));
  x.ontimeout = () => reject(new Error('timeout'));
  x.send();
});

// ===== Full scrape (URLs only for photos, bytes for docs since signed URLs expire) =====
window.__scrapeFull = async (jobId) => {
  const cfg = SOURCE_CONFIG;
  const token = cfg.tokenStorage();
  if (!token) throw new Error('no source-app session token in storage; check SOURCE_CONFIG.tokenStorage');
  const H = cfg.authHeader(token);
  const out = { job_id: jobId, photos: [], docs: [], errs: [] };

  // Photos (URL-only — fast even when tab is throttled)
  for (let page = 1; page <= cfg.maxPages; page++) {
    const r = await fetch(cfg.apiBase + cfg.photosListPath(jobId, page), { headers: H });
    if (r.status !== 200) { out.errs.push({ t: 'list', page, s: r.status }); break; }
    const j = await r.json();
    for (const p of (j.results || [])) out.photos.push(cfg.extractPhoto(p));
    if (!j.next) break;
  }

  // Docs (signed URLs — pull bytes immediately before expiry)
  try {
    const dr = await fetch(cfg.apiBase + cfg.docsListPath(jobId), { headers: H });
    if (dr.status === 200) {
      const dj = await dr.json();
      for (const d of (dj.results || [])) {
        const u = cfg.extractDocUrl(d);
        if (!u) continue;
        try {
          const got = await window.__xhrBytes(u);
          out.docs.push({ ...cfg.extractDocMeta(d), mime: got.mime, size: got.len, b64: got.b64 });
        } catch (e) { out.errs.push({ t: 'd', id: d.id, e: e.message }); }
      }
    }
  } catch (e) { out.errs.push({ t: 'doc-fetch', e: e.message }); }

  return out;
};

// ===== URL-only variant (no doc bytes) for the fast-pass when docs aren't needed =====
window.__getMetaUrlsOnly = async (jobId) => {
  const cfg = SOURCE_CONFIG;
  const token = cfg.tokenStorage();
  const H = cfg.authHeader(token);
  const out = { job_id: jobId, photos: [], docs: [], errs: [] };
  for (let page = 1; page <= cfg.maxPages; page++) {
    const r = await fetch(cfg.apiBase + cfg.photosListPath(jobId, page), { headers: H });
    if (r.status !== 200) { out.errs.push({ t: 'list', page, s: r.status }); break; }
    const j = await r.json();
    for (const p of (j.results || [])) out.photos.push(cfg.extractPhoto(p));
    if (!j.next) break;
  }
  return out;
};

// ===== Quick batch runner =====
// window.__runBatch(JOB_IDS) — runs sequentially, exposes progress via window.__bulk
window.__runBatch = async (jobIds, fn = window.__scrapeFull) => {
  window.__bulk = { state: 'running', jobs: [], errors: [], startedAt: Date.now() };
  for (const id of jobIds) {
    try {
      const r = await fn(id);
      window.__bulk.jobs.push(r);
      window.__bulk.progress = `${window.__bulk.jobs.length}/${jobIds.length} last=${id}_p${r.photos.length}_d${r.docs.length}_e${r.errs.length}`;
    } catch (e) {
      window.__bulk.errors.push({ id, e: e.message });
    }
  }
  window.__bulk.state = 'done';
  window.__bulk.elapsedMs = Date.now() - window.__bulk.startedAt;
  return window.__bulk;
};

// ===== Download helper =====
window.__downloadBundle = (filename = 'bundle_' + Date.now() + '.json') => {
  if (!window.__bulk?.jobs) throw new Error('no window.__bulk.jobs to download');
  const blob = new Blob([JSON.stringify({ jobs: window.__bulk.jobs })], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
  return { size: blob.size, jobs: window.__bulk.jobs.length, filename };
};

console.log('bulk-media-import helpers loaded. Run: window.__runBatch([id1, id2, ...])');
