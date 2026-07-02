#!/usr/bin/env node
/**
 * render-cf-app.mjs — the Content Forge app shell.
 *
 * Sidebar-nav single-page app that wraps every pipeline output:
 *   Workspace · Command Center, Research · Trends
 *   Create    · Brand Studio, Content Forge, AI Organizer, Library
 *   Publish   · Scheduler, SEO
 *
 * Data bound from existing JSON: candidates.json, suppliers.json,
 * research/*, shop-concepts/*, generated/* indexes, r2-uploads.json.
 *
 * Output: mockups/cf-app.html + auto-uploaded to R2 mjb/views/cf-app.html.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tryPutR2 } from '../../cloud-storage/scripts/r2-put.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DATA_DIR = path.join(REPO_ROOT, 'mockups', 'real-trends');
const RESEARCH_DIR = path.join(DATA_DIR, 'research');
const GENERATED_DIR = path.join(DATA_DIR, 'generated');
const OUT_HTML = path.join(REPO_ROOT, 'mockups', 'cf-app.html');

const sj = (p) => fs.existsSync(p) ? (() => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } })() : null;
const R2_PUBLIC_BASE = (process.env.R2_PUBLIC_BASE || 'https://pub-f1a237b322724dba9f9a00c5092d372f.r2.dev').replace(/\/$/, '');
// Rewrite local file paths under mockups/real-trends/generated/ -> R2 public URL.
// Used by templates so the deployed Pages site can load the assets.
function r2Url(localPath) {
  if (!localPath) return '';
  const rel = String(localPath).replace(/\\/g, '/').replace(/^\.\.?\//, '');
  // Map "mockups/real-trends/generated/<niche>/<file>" -> "mjb/products/<niche>/<file>"
  let m = rel.match(/mockups\/real-trends\/generated\/logos\/(.+)$/);
  if (m) return `${R2_PUBLIC_BASE}/mjb/logos/lanes/${m[1]}`;
  m = rel.match(/mockups\/real-trends\/generated\/shop-logos\/(.+)$/);
  if (m) return `${R2_PUBLIC_BASE}/mjb/shops/${m[1]}`;
  m = rel.match(/mockups\/real-trends\/generated\/videos\/(.+)$/);
  if (m) return `${R2_PUBLIC_BASE}/mjb/videos/${m[1]}`;
  m = rel.match(/mockups\/real-trends\/generated\/([^/]+)\/(.+)$/);
  if (m && m[1] !== 'shop-concepts') return `${R2_PUBLIC_BASE}/mjb/products/${m[1]}/${m[2]}`;
  return rel; // fallback (relative path)
}

const candidates = sj(path.join(DATA_DIR, 'candidates.json')) || [];
const suppliers = sj(path.join(DATA_DIR, 'suppliers.json')) || [];
const summary = sj(path.join(DATA_DIR, 'summary.json')) || { niches: [] };
const trends = sj(path.join(RESEARCH_DIR, 'trends-deep-dive.json'));
const ugc = sj(path.join(RESEARCH_DIR, 'ugc-best-practices.json'));
const insp = sj(path.join(RESEARCH_DIR, 'shop-design-inspiration.json'));
const concOAI = sj(path.join(RESEARCH_DIR, 'design-concepts-openai.json'));
const concGEM = sj(path.join(RESEARCH_DIR, 'design-concepts-gemini.json'));
const genIndex = sj(path.join(GENERATED_DIR, 'index.json')) || {};
const logoIndex = sj(path.join(GENERATED_DIR, 'logos', 'index.json')) || {};
const shopLogoIndex = sj(path.join(GENERATED_DIR, 'shop-logos', 'index.json')) || {};
const r2Uploads = sj(path.join(DATA_DIR, 'r2-uploads.json')) || [];
const r2Sites = r2Uploads.filter(u => u.key && u.key.startsWith('mjb/sites/') && u.key.endsWith('.html'));
const brandLanes = sj(path.join(REPO_ROOT, 'config', 'mjb', 'brand-lanes.json')) || { lanes: [] };

const shopConcepts = {};
const conceptsDir = path.join(GENERATED_DIR, 'shop-concepts');
if (fs.existsSync(conceptsDir)) {
  for (const f of fs.readdirSync(conceptsDir).filter(x => x.endsWith('.json'))) {
    shopConcepts[f.replace('.json', '')] = sj(path.join(conceptsDir, f));
  }
}

// Multi-category cluster shops (supersede single-niche shops per 2026-06-30 user feedback)
const shopClusters = {};
const clustersDir = path.join(GENERATED_DIR, 'shop-clusters');
const clusterIndex = sj(path.join(clustersDir, 'index.json')) || {};
if (fs.existsSync(clustersDir)) {
  for (const f of fs.readdirSync(clustersDir).filter(x => x.endsWith('.json') && x !== 'index.json')) {
    const key = f.replace('.json', '');
    shopClusters[key] = { concept: sj(path.join(clustersDir, f)), meta: clusterIndex[key] || {} };
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtNum = (n) => n == null ? '—' : Number(n).toLocaleString();
const fmtUsd = (n, dec = 0) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: dec });
const nicheLabel = (id) => id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Derived metrics
const byNiche = {};
for (const c of candidates) (byNiche[c._nicheId] ||= []).push(c);
const totalGenAssets = Object.values(genIndex).reduce((s, g) => s + (g.assets?.length || 0), 0) + Object.keys(shopLogoIndex).length + Object.values(logoIndex).reduce((s, l) => s + (l.assets?.length || 0), 0);
const r2BytesTotal = r2Uploads.reduce((s, u) => s + (u.bytes || 0), 0);
const r2Count = r2Uploads.length;
const profitable = candidates.filter(c => {
  const fees = c.priceUsd ? c.priceUsd * 0.15 + 3 : null;
  const landed = c._probableLandedCostUsd;
  if (!fees || !landed) return false;
  return (c.priceUsd - landed - fees) > 0;
}).length;
const medianMargin = (() => {
  const ms = candidates.map(c => {
    const fees = c.priceUsd ? c.priceUsd * 0.15 + 3 : null;
    const landed = c._probableLandedCostUsd;
    if (!fees || !landed || !c.priceUsd) return null;
    return (c.priceUsd - landed - fees) / c.priceUsd;
  }).filter(n => n != null).sort((a, b) => a - b);
  return ms.length ? ms[Math.floor(ms.length / 2)] : null;
})();

// Build R2 asset lists
const r2Images = r2Uploads.filter(u => u.contentType?.startsWith('image/'));
const r2Videos = r2Uploads.filter(u => u.contentType?.startsWith('video/'));
const r2Other = r2Uploads.filter(u => !u.contentType?.startsWith('image/') && !u.contentType?.startsWith('video/'));

// ===== LIVE BILLING (fix #2): derived from r2-uploads.json + per-asset cost stamps =====
const COST_PER = {
  'mjb/products/':       0.06,  // flux-1.1-pro-ultra or imagen-4 (close enough)
  'mjb/logos/lanes/':    0.06,
  'mjb/shops/concepts/': 0.001,
  'mjb/shops/':          0.06,
  'mjb/videos/':         0.80,  // mix of hailuo/luma/wan/veo-3-fast/sora — blended avg
  'mjb/avatars/':        0.30,
  'mjb/edits/':          0.04,  // nano-banana (gemini-2.5-flash-image)
  'mjb/research/':       0.0035,
  'mjb/views/':          0.0,
};
function computeLiveBilling() {
  const buckets = {};
  for (const u of r2Uploads) {
    for (const prefix of Object.keys(COST_PER)) {
      if (u.key.startsWith(prefix)) {
        buckets[prefix] = (buckets[prefix] || { count: 0, bytes: 0, cost: 0 });
        buckets[prefix].count++;
        buckets[prefix].bytes += u.bytes || 0;
        buckets[prefix].cost += COST_PER[prefix];
        break;
      }
    }
  }
  const replicateCost = (buckets['mjb/products/']?.cost || 0)
                     + (buckets['mjb/logos/lanes/']?.cost || 0)
                     + (buckets['mjb/shops/']?.cost || 0)
                     + (buckets['mjb/videos/']?.cost || 0)
                     + (buckets['mjb/avatars/']?.cost || 0);
  const openaiCost = (buckets['mjb/research/']?.cost || 0) * 0.7
                   + (buckets['mjb/shops/concepts/']?.cost || 0);
  const geminiCost = (buckets['mjb/research/']?.cost || 0) * 0.3
                   + (buckets['mjb/edits/']?.cost || 0); // nano-banana
  const r2GBmo = (r2Uploads.reduce((s, u) => s + (u.bytes || 0), 0) / 1024 / 1024 / 1024) * 0.015;
  const totalCost = replicateCost + openaiCost + geminiCost + r2GBmo;
  return { buckets, replicateCost, openaiCost, geminiCost, r2GBmo, totalCost, hardCapGlobal: 50, softCapGlobal: 25 };
}
const billing = computeLiveBilling();
const fmtCent = (n) => '$' + (n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

// Sidebar nav counts
const navCounts = {
  research: candidates.length,
  brandStudio: Object.keys(shopConcepts).length,
  forge: 12, // mock — these are "drafts" / generation projects in the queue
  organizer: 3,
  library: r2Count,
  scheduler: 8,
  seo: 24,
};

// ==========================================================
// Render
// ==========================================================
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Content Forge · MJB Operations</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,16..72,400;0,16..72,500;0,16..72,600;1,16..72,400;1,16..72,500&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:#f4efe6;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-family:'Archivo',system-ui,sans-serif;color:#23201a;overflow:hidden}
::selection{background:#c0492a;color:#fff}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:#d3c8b4;border:2px solid #f4efe6;border-radius:8px}
::-webkit-scrollbar-thumb:hover{background:#c0b59f}
.dark-scroll ::-webkit-scrollbar-thumb{background:#3a342b;border-color:#1b1815}
input,button,select,textarea{font-family:inherit}
input[type=range]{accent-color:#c0492a}
a{color:#c0492a;text-decoration:none}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
.live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#c0492a;animation:pulse 1.6s infinite}

/* ===== APP SHELL ===== */
.app{display:grid;grid-template-columns:var(--sb-w,248px) 1fr;height:100vh;overflow:hidden;transition:grid-template-columns .22s ease}
.app.sb-collapsed{--sb-w:64px}
.sb-toggle{display:flex;width:36px;height:36px;border:1px solid #d8cfbe;border-radius:7px;background:#fff;cursor:pointer;align-items:center;justify-content:center;font-size:16px;color:#23201a;flex-shrink:0;font-family:inherit}
.sb-toggle:hover{background:#fcf9f3}
.sb-backdrop{display:none;position:fixed;inset:0;background:rgba(35,32,26,.5);z-index:40;cursor:pointer}
.sb-backdrop.open{display:block;animation:rise .22s ease both}

/* SIDEBAR */
.sb{background:#211d18;display:flex;flex-direction:column;overflow:hidden;border-right:1px solid #000;transition:transform .22s ease,width .22s ease}
.app.sb-collapsed .sb-item-label,.app.sb-collapsed .sb-item-count,.app.sb-collapsed .sb-brand-name,.app.sb-collapsed .sb-brand-sub,.app.sb-collapsed .sb-group,.app.sb-collapsed .sb-acct-name,.app.sb-collapsed .sb-acct-sub,.app.sb-collapsed .sb-acct span:last-child{display:none}
.app.sb-collapsed .sb-item{justify-content:center;padding:11px 0}
.app.sb-collapsed .sb-item-icon{margin:0}
.app.sb-collapsed .sb-hdr,.app.sb-collapsed .sb-foot{padding:14px 0;justify-content:center}
.app.sb-collapsed .sb-acct{padding:0;background:transparent;justify-content:center}
.sb-hdr{padding:18px 18px 14px;display:flex;align-items:center;gap:11px;border-bottom:1px solid #322c24}
.sb-logo{width:30px;height:30px;border-radius:8px;background:#c0492a;display:flex;align-items:center;justify-content:center;font-family:'Newsreader',serif;font-weight:600;font-size:18px;color:#fff;flex-shrink:0}
.sb-brand-name{font-family:'Newsreader',serif;font-size:16px;font-weight:600;color:#f4efe6;line-height:1}
.sb-brand-sub{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;color:#897f6e;margin-top:3px}
.sb-nav{flex:1;overflow-y:auto;padding:10px 10px 16px}
.dark-scroll .sb-nav::-webkit-scrollbar-thumb{background:#3a342b;border-color:#211d18}
.sb-group{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:1.6px;text-transform:uppercase;color:#6f6658;padding:14px 10px 7px}
.sb-item{width:100%;display:flex;align-items:center;gap:11px;padding:9px 11px;border:0;border-radius:7px;cursor:pointer;text-align:left;background:transparent;color:#a89e8d;position:relative;transition:background .12s,color .12s;font-family:inherit}
.sb-item:hover{background:#2c2720;color:#e8e1d2}
.sb-item.active{background:#2c2720;color:#fff}
.sb-item.active::before{content:"";position:absolute;left:0;top:7px;bottom:7px;width:3px;border-radius:3px;background:#c0492a}
.sb-item-icon{display:flex;width:18px;justify-content:center;font-size:14px}
.sb-item-label{font-size:13px;font-weight:500;flex:1}
.sb-item.active .sb-item-label{font-weight:700}
.sb-item-count{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#6f6658}
.sb-item.active .sb-item-count{color:#c0492a}
.sb-foot{padding:12px;border-top:1px solid #322c24}
.sb-acct{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;background:#2a2620;cursor:pointer}
.sb-acct:hover{background:#322c24}
.sb-acct-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#c0492a,#9a3a20);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#fff;flex-shrink:0}
.sb-acct-name{font-size:12px;font-weight:600;color:#e8e1d2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-acct-sub{font-family:'JetBrains Mono',monospace;font-size:8.5px;color:#897f6e;display:flex;align-items:center;gap:5px}
.sb-acct-sub::before{content:"";width:6px;height:6px;border-radius:50%;background:#5fae7e}

/* MAIN */
.main{display:grid;grid-template-rows:auto 1fr;min-width:0;overflow:hidden}
.topbar{display:flex;align-items:center;gap:18px;padding:12px 24px;background:#f4efe6;border-bottom:1px solid #dad0bf;z-index:5}
.topbar-title-kicker{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#a89e8d}
.topbar-title{font-family:'Newsreader',serif;font-size:22px;font-weight:600;color:#23201a;line-height:1.05;margin-top:1px}
.topbar-search{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #d8cfbe;border-radius:8px;padding:8px 11px;width:280px}
.topbar-search input{border:0;outline:0;background:transparent;font-size:12.5px;width:100%;color:#23201a}
.topbar-search .key{font-family:'JetBrains Mono',monospace;font-size:9px;color:#bcb3a1;border:1px solid #e3dccd;border-radius:4px;padding:1px 5px}
.topbar-filters{display:flex;gap:0;background:#fff;border:1px solid #d8cfbe;border-radius:8px;padding:3px}
.topbar-filter{padding:6px 14px;border:0;background:transparent;font-size:12px;font-weight:600;color:#6f6658;cursor:pointer;border-radius:6px}
.topbar-filter.active{background:#23201a;color:#fff}
.topbar-cta{background:#c0492a;color:#fff;border:0;padding:9px 18px;font-size:13px;font-weight:700;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;margin-left:auto;font-family:inherit}
.topbar-cta:hover{background:#a13f25}
.topbar-user{display:flex;align-items:center;gap:8px;margin-left:auto;background:#fcf9f3;padding:5px 12px 5px 5px;border-radius:999px;border:1px solid #ece5d7;cursor:pointer;position:relative;font-family:inherit}
.topbar-user:hover{border-color:#c0492a}
.topbar-user-av{width:26px;height:26px;border-radius:50%;background:#c0492a;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Newsreader',serif;font-weight:600;font-size:13px}
.topbar-user-name{font-family:'JetBrains Mono',monospace;font-size:11px;color:#23201a;font-weight:600;letter-spacing:.2px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.topbar-user-menu{position:absolute;top:62px;right:90px;background:#fff;border:1px solid #dad0bf;border-radius:8px;box-shadow:0 12px 32px rgba(35,32,26,.15);min-width:240px;padding:6px;display:none;z-index:150}
.topbar-user-menu.open{display:block}
.topbar-user-menu-row{padding:10px 12px 8px;font-size:12px;color:#23201a;border-bottom:1px dashed #ece5d7;margin-bottom:4px}
.topbar-user-menu-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border:0;background:transparent;width:100%;text-align:left;font-family:inherit;font-size:13px;color:#23201a;text-decoration:none;border-radius:5px;cursor:pointer}
.topbar-user-menu-item:hover{background:#fcf9f3;color:#c0492a}
.topbar-cta{margin-left:0 !important}
.topbar{position:relative}
.topbar-cta{margin-left:10px !important}
.topbar-user{margin-left:auto !important}
@media (max-width: 720px){
  .topbar-user-name{display:none}
  .topbar-user-menu{right:14px}
}

/* VIEWS */
.view{display:none;overflow-y:auto;padding:24px 32px 60px}
.view.active{display:block;animation:rise .3s ease both}
.view-section{margin-bottom:32px}
.view-section-hdr{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding-bottom:10px;border-bottom:2px solid #23201a;margin-bottom:14px}
.view-section-hdr h2{font-family:'Newsreader',serif;font-weight:500;font-size:22px;letter-spacing:-.3px;color:#23201a}
.view-section-hdr .sub{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#6f6658;margin-top:3px}

/* PIPELINE FLOW (Command Center) */
.flow-band{display:grid;grid-template-columns:repeat(6,1fr);background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;overflow:hidden;margin-bottom:18px}
.flow-step{padding:18px 16px;border-right:1px solid #ece5d7;position:relative}
.flow-step:last-child{border-right:0}
.flow-step::after{content:"→";position:absolute;right:-9px;top:50%;transform:translateY(-50%);background:#f4efe6;color:#c0492a;font-weight:700;font-size:14px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%;z-index:1}
.flow-step:last-child::after{display:none}
.flow-kicker{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#a89e8d;font-weight:700}
.flow-num{font-size:22px;font-weight:800;color:#23201a;margin-top:6px;line-height:1.1;font-variant-numeric:tabular-nums}
.flow-lbl{font-size:13px;color:#6f6658;margin-top:2px}
.flow-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#c0492a;font-weight:700;margin-top:6px}

/* KPI TILES */
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px}
.kpi-tile{background:#fff;border:1px solid #dad0bf;border-radius:8px;padding:16px 18px;position:relative}
.kpi-tile-hdr{display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#a89e8d;font-weight:700;margin-bottom:8px}
.kpi-delta{color:#c0492a;font-weight:700}
.kpi-delta.live{display:flex;align-items:center;gap:4px;color:#c0492a}
.kpi-val{font-size:30px;font-weight:800;color:#23201a;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.5px}
.kpi-val.warn{color:#9b2d1b}
.kpi-val.good{color:#2c7a3e}
.kpi-val.accent{color:#c0492a}
.kpi-sub{font-family:'JetBrains Mono',monospace;font-size:9px;color:#6f6658;text-transform:uppercase;margin-top:6px;letter-spacing:.6px}

/* TWO-COL */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media (max-width:1100px){.two-col{grid-template-columns:1fr}}

/* QUEUE */
.queue-card{background:#fff;border:1px solid #dad0bf;border-radius:8px;padding:16px 18px}
.queue-hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px}
.queue-hdr h3{font-family:'Newsreader',serif;font-size:20px;font-weight:500}
.queue-hdr .badge{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#c0492a;font-weight:700}
.queue-row{display:grid;grid-template-columns:32px 1fr auto;gap:10px;padding:10px 0;border-bottom:1px dashed #ece5d7;align-items:center}
.queue-row:last-child{border-bottom:0}
.queue-icon{width:32px;height:32px;border-radius:6px;background:#fcf9f3;border:1px solid #ece5d7;display:flex;align-items:center;justify-content:center;font-size:16px;color:#c0492a}
.queue-name{font-size:13px;font-weight:600;color:#23201a}
.queue-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#6f6658;margin-top:2px}
.queue-status{font-family:'JetBrains Mono',monospace;font-size:9px;color:#fff;background:#c0492a;padding:2px 8px;border-radius:3px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
.queue-status.done{background:#2c7a3e}
.queue-status.queued{background:#897f6e}

/* RECENT ASSETS (Library preview) */
.assets-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:12px}
.asset-card{background:#fcf9f3;border:1px solid #ece5d7;border-radius:6px;aspect-ratio:1;position:relative;overflow:hidden;cursor:pointer;transition:transform .12s,border-color .12s}
.asset-card:hover{transform:translateY(-2px);border-color:#c0492a}
.asset-card img{width:100%;height:100%;object-fit:cover}
.asset-badge{position:absolute;top:6px;left:6px;background:rgba(35,32,26,.85);color:#fff;font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 6px;border-radius:3px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;backdrop-filter:blur(4px)}
.asset-badge.video{background:rgba(192,73,42,.92)}

/* LIBRARY view-specific */
.lib-storage{background:#fff;border:1px solid #dad0bf;border-radius:8px;padding:14px 18px;margin-bottom:18px}
.lib-storage-hdr{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.lib-storage-icon{width:28px;height:28px;background:#c0492a;border-radius:6px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
.lib-storage-title{font-size:13px;font-weight:700}
.lib-storage-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#6f6658;margin-left:auto}
.lib-storage-bar{height:6px;background:#ece5d7;border-radius:3px;overflow:hidden;margin-top:8px}
.lib-storage-fill{height:100%;background:linear-gradient(90deg,#c0492a,#d96b48);border-radius:3px}
.lib-tabs{display:flex;gap:6px;margin-bottom:14px}
.lib-tab{padding:6px 14px;border:1px solid #d8cfbe;border-radius:999px;background:#fff;font-size:12px;font-weight:600;color:#6f6658;cursor:pointer}
.lib-tab.active{background:#23201a;color:#fff;border-color:#23201a}
.lib-upload-btn{background:#c0492a;color:#fff;padding:7px 14px;border-radius:999px;font-weight:600;font-size:12px;cursor:pointer;border:0;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.lib-upload-btn:hover{background:#a13a20}
.lib-upload-btn.is-uploading{background:#6f6658;cursor:wait}

/* Library right-click context menu */
.ctx-menu{position:fixed;background:#fff;border:1px solid #dad0bf;border-radius:8px;box-shadow:0 8px 28px rgba(35,32,26,.18);min-width:220px;z-index:200;padding:6px;display:none;font-family:inherit}
.ctx-menu.open{display:block}
.ctx-item{padding:9px 14px;border-radius:5px;font-size:13px;color:#23201a;cursor:pointer;display:flex;align-items:center;gap:10px}
.ctx-item:hover{background:#fcf9f3;color:#c0492a}
.ctx-item-icon{width:18px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:13px;color:#a89e8d}
.ctx-item:hover .ctx-item-icon{color:#c0492a}
.ctx-sep{height:1px;background:#ece5d7;margin:4px 8px}
.ctx-item-disabled{opacity:.4;cursor:not-allowed}
.ctx-item-disabled:hover{background:transparent;color:#23201a}

/* Reuse-with-prompt modal */
.reuse-backdrop{position:fixed;inset:0;background:rgba(35,32,26,.6);z-index:300;display:none;align-items:center;justify-content:center;padding:20px}
.reuse-backdrop.open{display:flex}
.reuse-modal{background:#fcf9f3;border-radius:12px;max-width:760px;width:100%;max-height:90vh;overflow-y:auto;display:grid;grid-template-columns:280px 1fr;gap:0;border:1px solid #dad0bf}
.reuse-preview{background:#23201a;padding:18px;display:flex;align-items:center;justify-content:center;border-radius:12px 0 0 12px;overflow:hidden}
.reuse-preview img,.reuse-preview video{max-width:100%;max-height:380px;border-radius:6px;object-fit:contain}
.reuse-body{padding:24px}
.reuse-body h3{font-family:'Newsreader',serif;font-weight:500;font-size:22px;margin:0 0 4px;color:#23201a}
.reuse-body .reuse-src{font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d;word-break:break-all;margin-bottom:14px}
.reuse-body textarea{width:100%;min-height:120px;padding:12px 14px;border:1px solid #d8cfbe;border-radius:6px;font-family:inherit;font-size:13px;line-height:1.5;background:#fff;resize:vertical;box-sizing:border-box}
.reuse-body textarea:focus{outline:none;border-color:#c0492a}
.reuse-actions{display:flex;gap:8px;align-items:center;margin-top:14px}
.reuse-go{background:#c0492a;color:#fff;padding:10px 24px;border:0;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.reuse-go:hover{background:#a13a20}
.reuse-go:disabled{opacity:.5;cursor:wait}
.reuse-cancel{background:transparent;color:#6f6658;padding:10px 14px;border:0;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}
.reuse-status{margin-top:12px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#6f6658}
@media (max-width: 720px){
  .reuse-modal{grid-template-columns:1fr;max-height:96vh}
  .reuse-preview{border-radius:12px 12px 0 0;max-height:240px}
  .reuse-preview img,.reuse-preview video{max-height:200px}
}
.lib-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.lib-card{background:#fcf9f3;border:1px solid #ece5d7;border-radius:6px;overflow:hidden;cursor:pointer;transition:transform .12s,border-color .12s}
.lib-card:hover{transform:translateY(-3px);border-color:#c0492a}
.lib-card-img{aspect-ratio:1;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
.lib-card-img img{width:100%;height:100%;object-fit:cover}
.lib-card-body{padding:8px 10px}
.lib-card-name{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#6f6658;line-height:1.3;height:24px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;letter-spacing:.2px}
.lib-card-bytes{font-family:'JetBrains Mono',monospace;font-size:9px;color:#a89e8d;margin-top:2px}

/* BRAND STUDIO view */
.brand-grid{display:grid;grid-template-columns:1fr;gap:14px}
.brand-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;display:grid;grid-template-columns:280px 1fr;gap:18px;overflow:hidden}
.brand-card-logo{background:#fff;border-right:1px solid #ece5d7;aspect-ratio:3/2;display:flex;align-items:center;justify-content:center;overflow:hidden}
.brand-card-logo img{width:100%;height:100%;object-fit:contain;padding:18px}

/* Multi-category cluster shop cards (supersede per-niche brand cards) */
.cluster-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:18px}
.cluster-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.cluster-card-hd{background:#fff;border-bottom:1px solid #ece5d7;aspect-ratio:4/2;display:flex;align-items:center;justify-content:center;padding:12px;position:relative}
.cluster-card-logo{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
.cluster-card-logo img{max-width:100%;max-height:100%;object-fit:contain}
.cluster-card-tag{position:absolute;top:10px;left:10px;font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#c0492a;background:#fcf3ec;padding:3px 8px;border-radius:999px;font-weight:700}
.cluster-card-body{padding:18px 20px}
.cluster-niche-chip{font-family:'JetBrains Mono',monospace;font-size:10px;color:#23201a;background:#ece5d7;padding:3px 9px;border-radius:999px;letter-spacing:.2px}

/* Trends iframe shell — embed full master view inline */
.trends-iframe-shell{background:#fff;border:1px solid #dad0bf;border-radius:8px;overflow:hidden;height:calc(100vh - 200px);min-height:600px}
.trends-iframe{width:100%;height:100%;border:0;display:block;background:#fcf9f3}

/* Content Dashboard — unified feed */
.feed-filter-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.feed-filter{padding:6px 14px;border:1px solid #d8cfbe;border-radius:999px;background:#fff;font-size:12px;font-weight:600;color:#6f6658;cursor:pointer;font-family:inherit}
.feed-filter:hover{color:#23201a;border-color:#a89e8d}
.feed-filter.active{background:#23201a;color:#fff;border-color:#23201a}
.feed-day-group{margin-bottom:18px}
.feed-day-hdr{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:#a89e8d;font-weight:700;padding:8px 0;border-bottom:1px solid #ece5d7;margin-bottom:8px;display:flex;justify-content:space-between;align-items:baseline}
.feed-day-count{font-size:10px;color:#6f6658}
.feed-day-items{display:grid;gap:6px}
.feed-item{display:grid;grid-template-columns:64px 1fr 36px;gap:12px;padding:8px 10px;align-items:center;border-radius:6px;background:#fcf9f3;border:1px solid transparent;transition:border-color .12s, background .12s}
.feed-item:hover{border-color:#dad0bf;background:#fff}
.feed-item-thumb{width:64px;height:64px;background:#ece5d7;border-radius:5px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.feed-item-thumb img,.feed-item-thumb video{width:100%;height:100%;object-fit:cover}
.feed-item-ext{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#c0492a}
.feed-item-meta{min-width:0}
.feed-item-name{font-size:13px;font-weight:600;color:#23201a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.feed-item-sub{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;font-family:'JetBrains Mono',monospace;font-size:10px;color:#6f6658}
.feed-item-kind{color:#c0492a;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.feed-item-niche{color:#23201a;background:#ece5d7;padding:1px 6px;border-radius:3px}
.feed-item-by{color:#6f6658}
.feed-item-actions{display:flex;justify-content:flex-end}
.feed-act{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:5px;color:#23201a;text-decoration:none;font-size:13px;background:transparent}
.feed-act:hover{background:#ece5d7;color:#c0492a}

/* AI Organizer pipeline cards */
.org-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.org-card{background:#fff;border:1px solid #ece5d7;border-radius:8px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;transition:border-color .12s, transform .12s}
.org-card:hover{border-color:#c0492a;transform:translateY(-1px)}
.org-card-hd{display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase}
.org-stage{color:#c0492a;font-weight:700}
.org-est{color:#a89e8d}
.org-title{font-size:14px;font-weight:700;color:#23201a;margin:0;line-height:1.3}
.org-desc{font-size:12px;color:#6f6658;line-height:1.5;margin:0}
.org-cmd{display:block;background:#23201a;color:#fcf9f3;font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:8px 10px;border-radius:5px;white-space:nowrap;overflow-x:auto;letter-spacing:.2px}
.org-copy{background:transparent;border:1px solid #d8cfbe;color:#23201a;padding:7px 12px;border-radius:5px;font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer}
.org-copy:hover{background:#fcf9f3;border-color:#c0492a;color:#c0492a}
.org-copy.is-copied{background:#c0492a;color:#fff;border-color:#c0492a}
.org-actions{display:flex;gap:6px;margin-top:auto}
.org-start{background:#c0492a;color:#fff;border:0;padding:8px 14px;border-radius:5px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;flex:1}
.org-start:hover{background:#a13a20}
.org-start.is-queued{background:#897f6e}
.org-start.is-running{background:#2c7a3e}
.org-start:disabled{opacity:.6;cursor:wait}

/* Live jobs panel */
.jobs-panel{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;padding:18px 22px;margin-bottom:18px}
.jobs-panel-hdr{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
.jobs-refresh{background:transparent;color:#6f6658;border:1px solid #d8cfbe;padding:5px 12px;border-radius:5px;font-family:inherit;font-size:11px;cursor:pointer}
.jobs-refresh:hover{color:#c0492a;border-color:#c0492a}
.jobs-list{display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto}
.jobs-row{display:grid;grid-template-columns:90px 1fr 100px 80px;gap:10px;padding:8px 12px;background:#fff;border:1px solid #ece5d7;border-radius:5px;font-size:12px;align-items:center}
.jobs-status{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.4px;font-weight:700;text-align:center;padding:3px 8px;border-radius:3px}
.jobs-status.queued{background:#fcf3ec;color:#897f6e}
.jobs-status.running{background:#2c7a3e;color:#fff}
.jobs-status.completed{background:#eef2ed;color:#2c7a3e}
.jobs-status.failed{background:#fcf3ec;color:#9b2d1b}
.jobs-status.cancelled{background:#ece5d7;color:#6f6658}
.jobs-name{font-weight:600;color:#23201a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jobs-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#6f6658}
.jobs-row-act{display:flex;justify-content:flex-end;gap:4px}
.jobs-row-btn{background:transparent;border:0;cursor:pointer;color:#6f6658;font-size:14px;padding:4px 8px;border-radius:3px}
.jobs-row-btn:hover{background:#fcf3ec;color:#9b2d1b}
.jobs-agent-pill{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#a89e8d;background:#fcf3ec;padding:5px 11px;border-radius:999px;border:1px solid #ece5d7}
.jobs-agent-pill.is-online{color:#2c7a3e;background:#eef2ed;border-color:#bdd1bb}
.jobs-agent-pill.is-offline{color:#9b2d1b;background:#fcf3ec;border-color:#f0d4cb}

/* SEO Tracking — keyword tags per niche */
.seo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.seo-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;padding:16px 18px}
.seo-card-hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
.seo-card-hd h4{font-family:'Newsreader',serif;font-weight:500;font-size:17px;color:#23201a;margin:0}
.seo-row{margin-bottom:10px}
.seo-row-lbl{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#a89e8d;font-weight:700;margin-bottom:4px}
.seo-tags{display:flex;gap:4px;flex-wrap:wrap}
.seo-tag{font-size:11px;padding:3px 9px;border-radius:999px;letter-spacing:.1px}
.seo-tag-buy{background:#fcf3ec;color:#c0492a;font-weight:600}
.seo-tag-res{background:#ece5d7;color:#23201a}
.seo-tag-cmp{background:#eef2ed;color:#3d4a3c}

/* TikTok · Shop view */
.tt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.tt-card{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.tt-card-hd{display:flex;justify-content:space-between;align-items:baseline}
.tt-card-tag{font-family:'JetBrains Mono',monospace;font-size:11px;color:#c0492a;font-weight:700;letter-spacing:.2px}
.tt-card-niche{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:#6f6658}
.tt-card-links{display:flex;flex-direction:column;gap:5px}
.tt-link{display:flex;align-items:center;gap:8px;padding:7px 10px;background:#fff;border:1px solid #ece5d7;border-radius:5px;text-decoration:none;color:#23201a;font-size:12px;font-weight:500}
.tt-link:hover{border-color:#c0492a;color:#c0492a}
.tt-link-icon{font-size:13px;color:#a89e8d;width:18px;text-align:center}
.tt-link:hover .tt-link-icon{color:#c0492a}
.tt-link-host{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#a89e8d}

/* Photo editor modal */
.pe-backdrop{position:fixed;inset:0;background:rgba(20,18,14,.94);z-index:9500;display:none;align-items:stretch;justify-content:stretch;padding:0}
.pe-backdrop.open{display:flex}
.pe-modal{flex:1;display:grid;grid-template-columns:260px 1fr;background:#23201a;overflow:hidden}
.pe-tools{background:#fcf9f3;padding:18px 16px;overflow-y:auto;border-right:1px solid #dad0bf}
.pe-tool-grp{padding:10px 0;border-bottom:1px dashed #ece5d7;display:flex;flex-direction:column;gap:6px}
.pe-tool-grp:last-child{border-bottom:0}
.pe-tool-lbl{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#a89e8d;font-weight:700;margin-bottom:4px}
.pe-tool{background:#fff;border:1px solid #d8cfbe;color:#23201a;padding:8px 12px;border-radius:5px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;text-align:left}
.pe-tool:hover{border-color:#c0492a;color:#c0492a}
.pe-tool-danger{color:#9b2d1b;background:#fcf3ec;border-color:#f0d4cb}
.pe-tool-danger:hover{background:#9b2d1b;color:#fff;border-color:#9b2d1b}
.pe-save{background:#c0492a;color:#fff;border:0;padding:11px 14px;border-radius:5px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}
.pe-save:hover{background:#a13a20}
.pe-save:disabled{opacity:.55;cursor:wait}
.pe-slider{display:flex;flex-direction:column;gap:3px;font-size:11px;color:#6f6658;font-family:'JetBrains Mono',monospace}
.pe-slider input[type=range]{width:100%;accent-color:#c0492a}
.pe-text-in,.pe-text-color{padding:7px 10px;border:1px solid #d8cfbe;border-radius:5px;font-family:inherit;font-size:12px;background:#fff;width:100%;box-sizing:border-box}
.pe-stage{position:relative;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;background:#000}
.pe-stage canvas{max-width:100%;max-height:calc(100vh - 40px);box-shadow:0 0 0 1px rgba(255,255,255,.15);cursor:crosshair}
.pe-stage canvas.no-crop{cursor:default}

/* Tag editor modal */
.tag-backdrop{position:fixed;inset:0;background:rgba(35,32,26,.6);z-index:9400;display:none;align-items:center;justify-content:center;padding:24px}
.tag-backdrop.open{display:flex}
.tag-modal{background:#fcf9f3;border-radius:12px;max-width:520px;width:100%;padding:24px 28px;border:1px solid #dad0bf;box-shadow:0 24px 60px rgba(0,0,0,.3)}
.tag-src{font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d;word-break:break-all}
.tag-chips{display:flex;gap:6px;flex-wrap:wrap;min-height:34px}
.tag-chip{background:#fcf3ec;color:#c0492a;padding:5px 10px 5px 12px;border-radius:999px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:default}
.tag-chip-x{cursor:pointer;color:#a89e8d;font-family:'JetBrains Mono';font-size:13px;font-weight:400;line-height:1}
.tag-chip-x:hover{color:#9b2d1b}
.tag-suggestions{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.tag-suggest{background:#ece5d7;color:#23201a;padding:3px 9px;border-radius:999px;font-size:10.5px;cursor:pointer;border:0;font-family:inherit}
.tag-suggest:hover{background:#c0492a;color:#fff}

/* Library card hover actions — robust upscale UX */
.lib-card-img{position:relative}
.lib-hover-actions{position:absolute;inset:auto 0 0 0;background:linear-gradient(to top,rgba(35,32,26,.94),rgba(35,32,26,0));padding:32px 6px 6px;display:flex;flex-wrap:wrap;gap:3px;opacity:0;transition:opacity .12s}
.lib-card:hover .lib-hover-actions{opacity:1}
.lib-hover-btn{background:rgba(252,249,243,.95);color:#23201a;border:0;padding:5px 8px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;flex:1;min-width:48px;letter-spacing:.2px}
.lib-hover-btn:hover{background:#c0492a;color:#fff}
.lib-hover-btn[data-lib-act="upscale-4"]{background:#c0492a;color:#fff}
.lib-hover-btn[data-lib-act="upscale-4"]:hover{background:#a13a20}

/* Site Generator view */
.sg-wrap{display:grid;grid-template-columns:380px 1fr;gap:16px;min-height:calc(100vh - 200px)}
.sg-form{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;padding:20px 22px;display:flex;flex-direction:column;gap:14px}
.sg-form label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#a89e8d;font-weight:700;display:block;margin-bottom:4px}
.sg-form input,.sg-form textarea,.sg-form select{padding:10px 13px;border:1px solid #d8cfbe;border-radius:6px;font-family:inherit;font-size:13px;background:#fff;width:100%;box-sizing:border-box}
.sg-form input:focus,.sg-form textarea:focus{outline:none;border-color:#c0492a}
.sg-form textarea{min-height:140px;resize:vertical;font-family:'Newsreader',Georgia,serif;line-height:1.5}
.sg-palette-row{display:flex;gap:5px;flex-wrap:wrap}
.sg-palette-chip{width:32px;height:32px;border-radius:5px;cursor:pointer;border:2px solid transparent}
.sg-palette-chip.active{border-color:#23201a;transform:scale(1.1)}
.sg-go{background:#c0492a;color:#fff;border:0;padding:13px 16px;border-radius:6px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;margin-top:6px}
.sg-go:hover{background:#a13a20}
.sg-go:disabled{opacity:.55;cursor:wait}
.sg-status{font-family:'JetBrains Mono',monospace;font-size:11px;color:#6f6658}
.sg-preview{background:#fff;border:1px solid #dad0bf;border-radius:8px;overflow:hidden;display:flex;align-items:stretch}
.sg-preview-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#a89e8d;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.3px}
.sg-preview iframe{width:100%;border:0;background:#fff}
.sg-history{margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.sg-history-row{padding:9px 12px;background:#fcf9f3;border:1px solid #ece5d7;border-radius:5px;font-size:12px;cursor:pointer}
.sg-history-row:hover{border-color:#c0492a}
.sg-history-name{font-weight:600;color:#23201a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sg-history-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d;margin-top:2px}
@media (max-width: 900px){
  .sg-wrap{grid-template-columns:1fr}
}
@media (max-width: 720px){
  .feed-item{grid-template-columns:56px 1fr;gap:10px}
  .feed-item-thumb{width:56px;height:56px}
  .feed-item-actions{display:none}
}
.brand-card-body{padding:18px 22px}
.brand-name{font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.3px;color:#23201a;margin:4px 0 2px}
.brand-tag{font-family:'Newsreader',serif;font-style:italic;font-size:14px;color:#c0492a;margin-bottom:10px}
.brand-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}
.brand-arch{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;color:#fff;background:#c0492a;padding:3px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.5px}
.brand-pal{display:flex;gap:4px;margin:8px 0}
.brand-sw{padding:4px 8px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;letter-spacing:.3px}
.brand-rationale{font-size:11.5px;color:#6f6658;line-height:1.5;font-style:italic}

/* TRENDS view (links to master) */
.trends-banner{background:#fcf9f3;border:1px solid #dad0bf;border-radius:8px;padding:24px 28px}
.trends-banner h3{font-family:'Newsreader',serif;font-weight:500;font-size:28px;letter-spacing:-.3px;color:#23201a;margin-bottom:10px}
.trends-banner p{font-size:13px;color:#6f6658;margin-bottom:16px;line-height:1.6;max-width:680px}
.trends-banner-cta{background:#c0492a;color:#fff;padding:12px 22px;border-radius:8px;font-weight:700;font-size:13px;display:inline-block;text-decoration:none}
.trends-banner-cta:hover{background:#a13f25}

/* PLACEHOLDER views */
.placeholder{background:#fcf9f3;border:1px dashed #d8cfbe;border-radius:8px;padding:60px;text-align:center;color:#6f6658}
.placeholder h3{font-family:'Newsreader',serif;font-size:24px;color:#23201a;margin-bottom:8px}
.placeholder p{font-size:13px;max-width:480px;margin:0 auto;line-height:1.6}
.placeholder code{background:#fff;padding:2px 8px;border-radius:3px;font-size:11px;color:#c0492a;border:1px solid #ece5d7}

/* CONTENT FORGE (video editor) */
.cf-editor{display:grid;grid-template-columns:var(--cf-l,280px) 1fr var(--cf-r,280px);grid-template-rows:auto 1fr auto;gap:1px;background:#dad0bf;height:calc(100vh - 130px);border-radius:8px;overflow:hidden;border:1px solid #dad0bf;position:relative}
.cf-resize{position:absolute;top:50px;bottom:160px;width:6px;background:transparent;cursor:col-resize;z-index:5}
.cf-resize:hover{background:rgba(192,73,42,.3)}
.cf-resize.l{left:calc(var(--cf-l,280px) - 3px)}
.cf-resize.r{right:calc(var(--cf-r,280px) - 3px)}
.cf-toolbar{grid-column:1/-1;background:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #dad0bf}
.cf-tool{width:32px;height:32px;border:1px solid #ece5d7;background:#fff;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px}
.cf-tool:hover{background:#fcf9f3}
.cf-tool.play{background:#c0492a;color:#fff;border-color:#c0492a;width:36px;height:36px}
.cf-time{font-family:'JetBrains Mono',monospace;font-size:11px;color:#6f6658;margin-left:8px}
.cf-export-btn{margin-left:auto;background:#c0492a;color:#fff;padding:8px 18px;border:0;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit}
.cf-layers,.cf-props{background:#fff;padding:14px;overflow-y:auto}
.cf-canvas{background:#23201a;display:flex;align-items:center;justify-content:center;padding:24px}
.cf-canvas-frame{aspect-ratio:9/16;background:linear-gradient(180deg,#5a4030,#3a2820);border-radius:14px;border:1px solid rgba(255,255,255,.1);width:auto;height:100%;max-width:240px;display:flex;align-items:flex-end;padding:18px;color:#fff;text-align:center}
.cf-layer-hdr,.cf-prop-hdr{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#a89e8d;font-weight:700;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
.cf-layer{padding:8px 10px;border:1px solid #ece5d7;border-radius:5px;margin-bottom:4px;font-size:12px;color:#23201a;cursor:pointer;display:flex;align-items:center;gap:8px}
.cf-layer.active{background:#fcf9f3;border-color:#c0492a;color:#c0492a}
.cf-layer-icon{font-size:13px}
.cf-prop-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:12px;border-bottom:1px dashed #ece5d7}
.cf-timeline{grid-column:1/-1;background:#fff;padding:10px 14px;border-top:1px solid #dad0bf;height:140px}
.tl-hdr{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#a89e8d;font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between}
.tl-track{display:grid;grid-template-columns:80px 1fr;gap:10px;align-items:center;height:28px;margin-bottom:3px}
.tl-track-label{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;color:#6f6658;font-weight:700}
.tl-bar{height:22px;background:#fcf9f3;border-radius:3px;display:flex;gap:2px;padding:2px;position:relative}
.tl-clip{height:100%;border-radius:2px;font-size:9.5px;color:#fff;padding:3px 7px;font-weight:700;font-family:'JetBrains Mono',monospace;letter-spacing:.3px;display:flex;align-items:center}
.tl-clip.video{background:#4a73c4}
.tl-clip.overlay{background:#d99232}
.tl-clip.text{background:#c0492a}

/* CONTENT FORGE — Remotion + canva-clone iframe integration */
.cf-tabs{display:flex;gap:6px;margin:0 0 12px;border-bottom:1px solid #dad0bf;padding-bottom:0}
.cf-tab{padding:10px 16px 11px;border:0;border-bottom:2px solid transparent;background:transparent;font-family:inherit;font-size:13px;font-weight:600;color:#6f6658;cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-bottom:-1px}
.cf-tab:hover{color:#23201a}
.cf-tab.active{color:#c0492a;border-bottom-color:#c0492a}
.cf-tab-sub{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;color:#a89e8d;text-transform:uppercase;letter-spacing:.4px}
.cf-pane{display:none}
.cf-pane.active{display:block}
.cf-iframe-shell{position:relative;background:#23201a;border:1px solid #dad0bf;border-radius:8px;overflow:hidden;height:calc(100vh - 230px);min-height:520px}
.cf-iframe{width:100%;height:100%;border:0;background:#fff;display:block}
.cf-iframe-fallback{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:#fcf9f3;padding:32px;z-index:2}
.cf-iframe-fallback.show{display:flex}
.cf-fb-icon{font-size:46px;margin-bottom:14px;opacity:.55}
.cf-iframe-fallback h3{font-family:'Newsreader',serif;font-weight:500;font-size:22px;color:#23201a;margin:0 0 12px}
.cf-iframe-fallback p{color:#6f6658;font-size:13px;line-height:1.55;margin:6px 0;max-width:520px}
.cf-iframe-fallback pre{background:#23201a;color:#fcf9f3;padding:10px 16px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:12px;margin:10px 0 4px;max-width:560px;overflow-x:auto}
.cf-iframe-fallback code{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#c0492a;background:#fcf3ec;padding:1px 6px;border-radius:3px}
.cf-fb-link{margin-top:18px;display:inline-block;background:#c0492a;color:#fff;padding:9px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px}
.cf-asset-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;max-height:calc(100vh - 280px);overflow-y:auto;padding:4px}
.cf-asset{position:relative;aspect-ratio:1/1;background:#fcf9f3;border:1px solid #ece5d7;border-radius:6px;overflow:hidden;cursor:grab;transition:transform .12s, border-color .12s}
.cf-asset:hover{transform:translateY(-2px);border-color:#c0492a}
.cf-asset:active{cursor:grabbing}
.cf-asset img,.cf-asset video{width:100%;height:100%;object-fit:cover}
.cf-asset-tag{position:absolute;bottom:4px;left:4px;background:rgba(35,32,26,.82);color:#fcf9f3;font-family:'JetBrains Mono',monospace;font-size:9px;padding:2px 6px;border-radius:3px;text-transform:uppercase;letter-spacing:.3px;z-index:2}
.cf-asset-overlay{position:absolute;inset:auto 0 0 0;background:linear-gradient(to top,rgba(35,32,26,.95),rgba(35,32,26,0));padding:24px 6px 6px;display:flex;gap:4px;opacity:0;transition:opacity .15s;z-index:3}
.cf-asset:hover .cf-asset-overlay{opacity:1}
.cf-asset-act{flex:1;background:rgba(252,249,243,.92);color:#23201a;border:0;padding:5px 6px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;cursor:pointer;letter-spacing:.2px;text-transform:uppercase}
.cf-asset-act:hover{background:#c0492a;color:#fff}
.cf-static-mode{padding:6px 14px;border:1px solid #d8cfbe;border-radius:999px;background:#fff;font-size:11.5px;font-weight:600;color:#6f6658;cursor:pointer;font-family:inherit}
.cf-static-mode:hover{border-color:#c0492a;color:#c0492a}
.cf-static-mode.active{background:#23201a;color:#fff;border-color:#23201a}
.cf-static-share{background:#c0492a;color:#fff;padding:6px 14px;border:0;border-radius:5px;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer}
.cf-static-share:hover{background:#a13a20}

/* ---- Editor header chrome (shared by Postiz / Motion / Static) ---- */
.ed-header-actions{display:flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px}
.ed-status-pill{display:inline-flex;align-items:center;gap:6px;background:#eef2ed;color:#2c7a3e;padding:5px 11px;border-radius:999px;border:1px solid #bdd1bb;font-weight:600;letter-spacing:.2px}
.ed-status-dot{width:7px;height:7px;border-radius:50%;background:#2c7a3e;animation:edPulse 1.8s ease-in-out infinite}
@keyframes edPulse{0%,100%{opacity:1}50%{opacity:.4}}
.ed-btn{background:#23201a;color:#fff;padding:6px 14px;border-radius:5px;font-family:inherit;font-size:11.5px;font-weight:700;text-decoration:none;border:0;cursor:pointer}
.ed-btn:hover{background:#000}
.ed-btn-ghost{background:#fcf3ec;color:#23201a;padding:6px 10px;border-radius:5px;font-family:inherit;font-size:13px;font-weight:600;border:1px solid #ece5d7;cursor:pointer}
.ed-btn-ghost:hover{border-color:#c0492a;color:#c0492a}
.ed-tabs{display:flex;align-items:center;gap:6px;margin:10px 0 8px;border-bottom:1px solid #ece5d7;padding-bottom:0;flex-wrap:wrap}
.ed-tab{padding:8px 14px 9px;border:0;border-bottom:2px solid transparent;background:transparent;font-family:inherit;font-size:12px;font-weight:600;color:#6f6658;cursor:pointer;margin-bottom:-1px}
.ed-tab:hover{color:#23201a}
.ed-tab.active{color:#c0492a;border-bottom-color:#c0492a}
.ed-tab-spacer{flex:1}
.ed-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d;letter-spacing:.2px}
.ed-iframe-shell{border:1px solid #dad0bf;border-radius:8px;overflow:hidden;height:calc(100vh - 270px);min-height:540px;background:#23201a}
.ed-iframe-shell .cf-iframe{display:block;width:100%;height:100%;border:0;background:#fcf9f3}
.ed-foot{margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#6f6658;padding:8px 12px;background:#fcf9f3;border:1px solid #ece5d7;border-radius:5px}
.ed-foot a:hover{color:#a13a20}

/* Editor launcher card (shown when page is HTTPS → iframe localhost blocked by mixed-content) */
body.is-https .cf-iframe{display:none}
body.is-https .cf-iframe-shell{background:#fcf9f3;height:auto;min-height:360px}
.cf-launcher{padding:40px 32px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px}
.cf-launcher-icon{font-size:54px;opacity:.7}
.cf-launcher h3{font-family:'Newsreader',serif;font-weight:500;font-size:26px;color:#23201a;margin:0}
.cf-launcher .cf-launcher-url{font-family:'JetBrains Mono',monospace;font-size:13px;color:#c0492a;background:#fcf3ec;padding:6px 14px;border-radius:5px;display:inline-block}
.cf-launcher p{color:#6f6658;font-size:13px;line-height:1.6;margin:0;max-width:560px}
.cf-launcher-cta{background:#c0492a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer;font-family:inherit}
.cf-launcher-cta:hover{background:#a13a20}
.cf-launcher-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d;letter-spacing:.3px;text-transform:uppercase}
.cf-launcher-note{background:#f4efe6;border-left:3px solid #c0492a;padding:10px 14px;font-size:12px;color:#6f6658;text-align:left;max-width:560px;border-radius:4px}
body:not(.is-https) .cf-launcher{display:none}
body.is-https .cf-iframe-fallback{display:none !important}

/* Domains section in Billing view */
.domains-card{background:#fff;border:1px solid #dad0bf;border-radius:8px;padding:20px 22px;margin-top:18px}
.domain-input-row{display:flex;gap:8px;margin:14px 0 6px}
.domain-input{flex:1;padding:10px 14px;border:1px solid #d8cfbe;border-radius:6px;font-family:inherit;font-size:14px;background:#fcf9f3}
.domain-input:focus{outline:none;border-color:#c0492a}
.domain-lookup-btn{background:#23201a;color:#fff;padding:10px 22px;border:0;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}
.domain-lookup-btn:hover{background:#000}
.domain-result{margin-top:12px;padding:14px 16px;background:#fcf9f3;border:1px solid #ece5d7;border-radius:6px;font-size:13px;display:none}
.domain-result.show{display:block}
.domain-result .res-row{display:flex;justify-content:space-between;padding:4px 0;font-family:'JetBrains Mono',monospace;font-size:12px}
.domain-result .res-row span:last-child{color:#23201a;font-weight:700}
.tld-table{width:100%;margin-top:10px;border-collapse:collapse;font-size:12px}
.tld-table th{text-align:left;padding:8px 10px;color:#a89e8d;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.6px;text-transform:uppercase;border-bottom:1px solid #ece5d7}
.tld-table td{padding:7px 10px;border-bottom:1px dashed #ece5d7;font-family:'JetBrains Mono',monospace}
.tld-table tr:hover td{background:#fcf9f3;cursor:pointer}
.tld-table .price{color:#c0492a;font-weight:700;text-align:right}
.tld-note{background:#eef2ed;border-left:3px solid #5d8c5a;padding:8px 12px;font-size:12px;color:#3d4a3c;border-radius:4px;margin-top:10px}

/* New Generate modal */
.modal-backdrop{position:fixed;inset:0;background:rgba(35,32,26,.6);z-index:250;align-items:center;justify-content:center;padding:24px;overflow-y:auto}
.modal-backdrop[style*="flex"]{display:flex !important}
.modal{background:#fcf9f3;border-radius:12px;max-width:720px;width:100%;max-height:88vh;overflow-y:auto;padding:28px 30px 24px;border:1px solid #dad0bf;position:relative;box-shadow:0 24px 60px rgba(0,0,0,.3)}
.modal-close{position:absolute;top:14px;right:14px;width:32px;height:32px;border:0;border-radius:50%;background:#fcf3ec;color:#23201a;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit}
.modal-close:hover{background:#c0492a;color:#fff}
.kicker{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:#a89e8d;font-weight:700}
.gen-options{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:6px 0 14px}
.gen-opt{text-align:left;background:#fff;border:1px solid #ece5d7;border-radius:8px;padding:14px 16px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:6px;transition:border-color .12s, transform .12s}
.gen-opt:hover{border-color:#c0492a;transform:translateY(-1px)}
.gen-opt-title{font-size:13px;font-weight:700;color:#23201a;line-height:1.3}
.gen-opt-sub{font-size:11px;color:#6f6658;line-height:1.45}
.gen-opt code{display:block;background:#23201a;color:#fcf9f3;font-family:'JetBrains Mono',monospace;font-size:10px;padding:6px 8px;border-radius:4px;margin-top:4px;white-space:nowrap;overflow-x:auto;letter-spacing:.2px}
.modal-foot{font-size:11.5px;color:#6f6658;border-top:1px solid #ece5d7;padding-top:12px;margin-top:4px}
@media (max-width: 720px){
  .gen-options{grid-template-columns:1fr}
  .modal{padding:22px 18px 18px}
}

/* Settings — API keys per-user */
.key-row{display:grid;grid-template-columns:1fr 90px 1fr auto auto;gap:8px;align-items:center;padding:12px 0;border-bottom:1px dashed #ece5d7}
.key-row-info{min-width:0}
.key-row-label{font-size:13px;font-weight:600;color:#23201a}
.key-row-name{font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d;margin-left:6px;letter-spacing:.3px}
.key-row-hint{font-size:11px;color:#6f6658;margin-top:2px}
.key-row-state{font-family:'JetBrains Mono',monospace;font-size:10px;text-align:center;text-transform:uppercase;letter-spacing:.4px}
.key-set{color:#2c7a3e;font-weight:700}
.key-empty{color:#a89e8d}
.key-row-input{padding:8px 10px;border:1px solid #d8cfbe;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:12px;background:#fff;min-width:0}
.key-row-input:focus{outline:none;border-color:#c0492a}
.key-row-btn{background:#23201a;color:#fff;padding:8px 14px;border:0;border-radius:5px;font-weight:600;font-size:11px;cursor:pointer;font-family:inherit}
.key-row-btn:hover{background:#000}
.key-row-btn:disabled{opacity:.5;cursor:wait}
.key-row-btn-danger{background:#fff;color:#9b2d1b;border:1px solid #d8cfbe}
.key-row-btn-danger:hover{background:#fcf3ec}
@media (max-width: 768px){
  .key-row{grid-template-columns:1fr;gap:6px}
  .key-row-state{text-align:left}
}
</style>
</head>
<body class="dark-scroll">

<div class="sb-backdrop" id="sbBackdrop"></div>
<div class="app" id="app">

  <!-- =============== SIDEBAR =============== -->
  <aside class="sb" id="sb">
    <div class="sb-hdr">
      <div class="sb-logo">F</div>
      <div>
        <div class="sb-brand-name">Content Forge</div>
        <div class="sb-brand-sub">MJB Operations</div>
      </div>
    </div>
    <nav class="sb-nav">
      <div class="sb-group">Workspace</div>
      <button class="sb-item active" data-view="cmd"><span class="sb-item-icon">◉</span><span class="sb-item-label">Command Center</span><span class="sb-item-count"></span></button>
      <button class="sb-item" data-view="trends"><span class="sb-item-icon">⌕</span><span class="sb-item-label">Research · Trends</span><span class="sb-item-count">${navCounts.research}</span></button>
      <button class="sb-item" data-view="feed"><span class="sb-item-icon">⊟</span><span class="sb-item-label">Content Dashboard</span><span class="sb-item-count">${r2Uploads.length}</span></button>
      <button class="sb-item" data-view="tiktok"><span class="sb-item-icon">♪</span><span class="sb-item-label">TikTok · Shop</span><span class="sb-item-count">${Object.keys(byNiche).length}</span></button>
      <button class="sb-item" data-view="sitegen"><span class="sb-item-icon">◐</span><span class="sb-item-label">Site Generator</span><span class="sb-item-count">AI</span></button>

      <div class="sb-group">Create</div>
      <button class="sb-item" data-view="brand"><span class="sb-item-icon">◎</span><span class="sb-item-label">Brand Studio</span><span class="sb-item-count">${navCounts.brandStudio}</span></button>
      <button class="sb-item" data-view="forge"><span class="sb-item-icon">≡</span><span class="sb-item-label">Content Forge</span><span class="sb-item-count">${navCounts.forge}</span></button>
      <button class="sb-item" data-view="organizer"><span class="sb-item-icon">✦</span><span class="sb-item-label">AI Organizer</span><span class="sb-item-count">${navCounts.organizer}</span></button>
      <button class="sb-item" data-view="library"><span class="sb-item-icon">▦</span><span class="sb-item-label">Library</span><span class="sb-item-count">${navCounts.library}</span></button>

      <div class="sb-group">Publish</div>
      <button class="sb-item" data-view="scheduler"><span class="sb-item-icon">☷</span><span class="sb-item-label">Scheduler</span><span class="sb-item-count">${navCounts.scheduler}</span></button>
      <button class="sb-item" data-view="seo"><span class="sb-item-icon">⟳</span><span class="sb-item-label">SEO</span><span class="sb-item-count">${navCounts.seo}</span></button>

      <div class="sb-group">Admin</div>
      <button class="sb-item" data-view="billing"><span class="sb-item-icon">$</span><span class="sb-item-label">Billing &amp; usage</span><span class="sb-item-count">${fmtCent(billing.totalCost).replace(/\.00$/, '')}</span></button>
      <button class="sb-item" data-view="settings"><span class="sb-item-icon">⚙</span><span class="sb-item-label">Settings · API keys</span><span class="sb-item-count" id="sbSettingsCount">—</span></button>
    </nav>
    <div class="sb-foot">
      <div class="sb-acct">
        <div class="sb-acct-av">MJ</div>
        <div style="min-width:0;flex:1">
          <div class="sb-acct-name">MJB Studio</div>
          <div class="sb-acct-sub">R2 synced</div>
        </div>
        <span style="color:#6f6658;font-size:14px">⋯</span>
      </div>
    </div>
  </aside>

  <!-- =============== MAIN =============== -->
  <div class="main">
    <header class="topbar">
      <button class="sb-toggle" id="sbToggle" aria-label="Toggle sidebar">☰</button>
      <div style="min-width:0">
        <div class="topbar-title-kicker" id="viewKicker">MJB Operations</div>
        <div class="topbar-title" id="viewTitle">Command Center</div>
      </div>
      <div class="topbar-search">
        <span style="color:#a89e8d">⌕</span>
        <input type="text" placeholder="Search everything…">
        <span class="key">⌘K</span>
      </div>
      <div class="topbar-filters">
        <button class="topbar-filter active">All</button>
        <button class="topbar-filter">Home</button>
        <button class="topbar-filter">Tech</button>
        <button class="topbar-filter">Utility</button>
      </div>
      <div class="topbar-user" id="topbarUser" title="Signed in"><span class="topbar-user-av">?</span><span class="topbar-user-name">…</span></div>
      <div class="topbar-user-menu" id="topbarUserMenu">
        <div class="topbar-user-menu-row"><span style="color:#a89e8d">Signed in as</span> <strong id="topbarUserMenuName">…</strong></div>
        <a href="/settings" class="topbar-user-menu-item" data-tum-action="settings"><span style="font-family:'JetBrains Mono';font-size:12px;width:18px">⚙</span>Settings · API keys</a>
        <button class="topbar-user-menu-item" data-tum-action="logout"><span style="font-family:'JetBrains Mono';font-size:12px;width:18px">↪</span>Sign out</button>
      </div>
      <button class="topbar-cta" id="newGenBtn">+ <span>New generate</span></button>
    </header>

    <!-- New Generate modal -->
    <div class="modal-backdrop" id="newGenModal" style="display:none">
      <div class="modal">
        <button class="modal-close" id="newGenClose" aria-label="Close">✕</button>
        <div class="kicker">Pipeline command</div>
        <h2 style="font-family:'Newsreader',serif;font-weight:500;font-size:24px;margin-top:6px;margin-bottom:14px">What do you want to generate?</h2>
        <div class="gen-options">
          <button class="gen-opt" data-cmd="pull-trends">
            <div class="gen-opt-title">🔄 Refresh trends from RapidAPI</div>
            <div class="gen-opt-sub">Re-pull Amazon + Taobao for all 10 niches · free (within quotas)</div>
            <code>node packages/capabilities/product-intelligence/scripts/pull-trends.mjs</code>
          </button>
          <button class="gen-opt" data-cmd="batch-images">
            <div class="gen-opt-title">🖼 Generate product images (top N per niche)</div>
            <div class="gen-opt-sub">Replicate flux-1.1-pro-ultra · ~$0.06/image · dedup skips existing</div>
            <code>node packages/capabilities/media-generation/scripts/batch-generate-from-candidates.mjs --top 5</code>
          </button>
          <button class="gen-opt" data-cmd="shop-logos">
            <div class="gen-opt-title">🏷 Generate shop logos (LLM concept + Replicate logo)</div>
            <div class="gen-opt-sub">~$0.61 total for 10 niches · existing logos reused</div>
            <code>node packages/capabilities/media-generation/scripts/generate-shop-logos.mjs</code>
          </button>
          <button class="gen-opt" data-cmd="video">
            <div class="gen-opt-title">🎬 Generate product video (4 models)</div>
            <div class="gen-opt-sub">hailuo $0.50 · luma $0.40 · kling $0.25 (req credit) · wan $0.08</div>
            <code>node packages/capabilities/media-generation/scripts/generate-videos.mjs --all-models</code>
          </button>
          <button class="gen-opt" data-cmd="avatar">
            <div class="gen-opt-title">🧊 Generate 3D avatar / mesh (.glb)</div>
            <div class="gen-opt-sub">trellis $0.30 · hunyuan3d $0.40 · sf3d $0.04 (fastest)</div>
            <code>node packages/capabilities/media-generation/scripts/generate-avatar.mjs --model sf3d</code>
          </button>
          <button class="gen-opt" data-cmd="research">
            <div class="gen-opt-title">📚 Re-run LLM research (OpenAI + Gemini)</div>
            <div class="gen-opt-sub">~$0.025 · trends + UGC + inspiration + design concepts × 10 niches</div>
            <code>node packages/capabilities/product-intelligence/scripts/research-with-openai.mjs &amp;&amp; node packages/capabilities/product-intelligence/scripts/research-with-gemini.mjs</code>
          </button>
          <button class="gen-opt" data-cmd="render-deploy">
            <div class="gen-opt-title">🚀 Re-render + redeploy this app</div>
            <div class="gen-opt-sub">Bake latest data into cf-app.html + push to Cloudflare Pages</div>
            <code>bash scripts/deploy-cf-pages.sh</code>
          </button>
        </div>
        <div class="modal-foot">
          <span class="muted small">These commands run locally in your terminal. Click any option to copy. A real "trigger via worker" path is on the roadmap.</span>
        </div>
      </div>
    </div>

    <!-- ========== COMMAND CENTER ========== -->
    <section class="view active" data-view="cmd">

      <div class="flow-band">
        <div class="flow-step">
          <div class="flow-kicker">Ingest</div>
          <div class="flow-num">${summary.niches?.length || 0}</div>
          <div class="flow-lbl">sources</div>
          <div class="flow-meta">${summary.niches?.length || 0} live</div>
        </div>
        <div class="flow-step">
          <div class="flow-kicker">Research</div>
          <div class="flow-num">${candidates.length}</div>
          <div class="flow-lbl">candidates</div>
          <div class="flow-meta">${profitable} strong</div>
        </div>
        <div class="flow-step">
          <div class="flow-kicker">Brand</div>
          <div class="flow-num">${brandLanes.lanes.length}</div>
          <div class="flow-lbl">lanes</div>
          <div class="flow-meta">named</div>
        </div>
        <div class="flow-step">
          <div class="flow-kicker">Forge</div>
          <div class="flow-num">${totalGenAssets}</div>
          <div class="flow-lbl">generations</div>
          <div class="flow-meta">${navCounts.forge} drafts</div>
        </div>
        <div class="flow-step">
          <div class="flow-kicker">Schedule</div>
          <div class="flow-num">${navCounts.scheduler}</div>
          <div class="flow-lbl">queued</div>
          <div class="flow-meta">2 today</div>
        </div>
        <div class="flow-step">
          <div class="flow-kicker">Publish</div>
          <div class="flow-num">6</div>
          <div class="flow-lbl">channels</div>
          <div class="flow-meta">connected</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>R2 storage</span><span class="kpi-delta">+${(r2BytesTotal/1024/1024/100).toFixed(1)}</span></div>
          <div class="kpi-val">${(r2BytesTotal/1024/1024/1024).toFixed(2)} GB</div>
          <div class="kpi-sub">${r2Count} objects in mjb-commerce-media</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Assets</span><span class="kpi-delta">+${totalGenAssets}</span></div>
          <div class="kpi-val">${totalGenAssets}</div>
          <div class="kpi-sub">generated this session</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Jobs running</span><span class="kpi-delta live"><span class="live-dot"></span>live</span></div>
          <div class="kpi-val accent">3</div>
          <div class="kpi-sub">background pipelines</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Scheduled</span><span class="kpi-delta">2 today</span></div>
          <div class="kpi-val">${navCounts.scheduler}</div>
          <div class="kpi-sub">posts in queue</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Keywords</span><span class="kpi-delta">+8</span></div>
          <div class="kpi-val">${navCounts.seo}</div>
          <div class="kpi-sub">tracked SEO terms</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Median margin</span><span class="kpi-delta">research</span></div>
          <div class="kpi-val ${medianMargin > 0 ? 'good' : 'warn'}">${medianMargin != null ? (medianMargin * 100).toFixed(0) + '%' : '—'}</div>
          <div class="kpi-sub">across ${candidates.length} candidates</div>
        </div>
      </div>

      <div class="two-col">
        <div class="queue-card">
          <div class="queue-hdr">
            <h3>Generation queue</h3>
            <span class="badge">AI Organizer</span>
          </div>
          ${(() => {
            // Live recent activity — last 6 R2 uploads sorted by uploadedAt DESC
            const recent = [...r2Uploads]
              .filter(u => u.uploadedAt && !u.key.startsWith('mjb/views/') && !u.key.startsWith('PING'))
              .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''))
              .slice(0, 6);
            const now = Date.now();
            const iconFor = (key) => key.startsWith('mjb/videos/') ? '🎬'
                                  : key.startsWith('mjb/edits/')  ? '✂️'
                                  : key.startsWith('mjb/avatars/')? '🧱'
                                  : key.startsWith('mjb/shops/')  ? '🎨'
                                  : key.startsWith('mjb/logos/')  ? '🅻'
                                  : key.startsWith('mjb/research/') ? '🧠'
                                  : '🖼';
            const labelFor = (key) => {
              const name = key.split('/').slice(-1)[0].replace(/\.[a-z0-9]+$/i, '').slice(0, 38);
              const niche = key.split('/').slice(-2, -1)[0] || key.split('/').slice(0, 2).join('/');
              return { name, niche };
            };
            const agoMin = (iso) => {
              const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
              return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.round(m/60)}h ago`;
            };
            return recent.map(u => {
              const { name, niche } = labelFor(u.key);
              return { icon: iconFor(u.key), name, meta: `${niche} · ${agoMin(u.uploadedAt)} · ${(u.bytes/1024).toFixed(0)}KB`, status: 'DONE', cls: 'done' };
            });
          })().map(q => `
            <div class="queue-row">
              <div class="queue-icon">${q.icon}</div>
              <div>
                <div class="queue-name">${esc(q.name)}</div>
                <div class="queue-meta">${esc(q.meta)}</div>
              </div>
              <span class="queue-status ${q.cls||''}">${q.status}</span>
            </div>
          `).join('')}
        </div>

        <div class="queue-card">
          <div class="queue-hdr">
            <h3>Recent assets</h3>
            <span class="badge">Library</span>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d;margin-bottom:8px">Right-click any asset to edit</div>
          <div class="assets-grid">
            ${r2Images.slice(0, 16).map(a => `
              <div class="asset-card">
                <img src="${esc(R2_PUBLIC_BASE + '/' + a.key)}" alt="">
                <span class="asset-badge">${esc(a.key.split('/').slice(-2, -1)[0] || 'asset')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>

    <!-- ========== RESEARCH · TRENDS ========== -->
    <section class="view" data-view="trends">
      <div class="view-section-hdr" style="margin-bottom:10px">
        <div>
          <h2>Category Opportunity <span style="font-style:italic;color:#c0492a">Scan</span></h2>
          <div class="sub">${Object.keys(byNiche).length} niches · ${Object.values(byNiche).reduce((s,a)=>s+a.length,0)} candidates · live RapidAPI data</div>
        </div>
        <a href="/mjb-master-view" target="_blank" rel="noopener" style="background:#fcf3ec;color:#c0492a;padding:7px 14px;border-radius:999px;font-size:11.5px;font-weight:600;text-decoration:none;font-family:inherit">Open full-screen ↗</a>
      </div>
      <div class="trends-iframe-shell">
        <iframe src="/mjb-master-view" class="trends-iframe" id="trendsFrame" loading="lazy" allow="clipboard-write"></iframe>
      </div>
    </section>

    <!-- ========== TIKTOK · SHOP (live discovery + per-niche hashtag links) ========== -->
    <section class="view" data-view="tiktok">
      <div class="view-section-hdr" style="margin-bottom:14px">
        <div>
          <h2>TikTok · <span style="font-style:italic;color:#c0492a">Shop</span></h2>
          <div class="sub">Live discovery for each MJB niche · TikTok's iframe rules block direct embed on most pages, so we link out + offer hashtag drilldowns</div>
        </div>
        <a href="https://shop.tiktok.com/" target="_blank" rel="noopener" style="background:#fcf3ec;color:#c0492a;padding:7px 14px;border-radius:999px;font-size:11.5px;font-weight:600;text-decoration:none;font-family:inherit">Open TikTok Shop ↗</a>
      </div>

      <div class="tt-grid">
        ${Object.keys(byNiche).map(n => {
          const label = nicheLabel(n);
          const hashtag = n.replace(/-/g, '');
          const search = encodeURIComponent(label);
          // Pull top candidate name as the recommended search seed
          const top = (byNiche[n] || []).sort((a,b) => (b.reviewSummary?.count||0)-(a.reviewSummary?.count||0))[0];
          const topName = top?.name?.split(',')[0].split('(')[0].trim().slice(0, 50) || label;
          return `<div class="tt-card" data-lane="${esc(byNiche[n]?.[0]?._lane || '')}">
            <div class="tt-card-hd"><span class="tt-card-tag">#${esc(hashtag)}</span><span class="tt-card-niche">${esc(label)}</span></div>
            <div class="tt-card-links">
              <a href="https://www.tiktok.com/tag/${esc(hashtag)}" target="_blank" rel="noopener" class="tt-link"><span class="tt-link-icon">♪</span> Trending videos <span class="tt-link-host">tiktok.com</span></a>
              <a href="https://shop.tiktok.com/search?q=${search}" target="_blank" rel="noopener" class="tt-link"><span class="tt-link-icon">🛒</span> TikTok Shop search <span class="tt-link-host">shop.tiktok.com</span></a>
              <a href="https://www.tiktok.com/search?q=${encodeURIComponent(topName)}" target="_blank" rel="noopener" class="tt-link"><span class="tt-link-icon">⌕</span> "${esc(topName.slice(0,40))}" <span class="tt-link-host">tiktok.com</span></a>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div style="margin-top:24px">
        <h3 style="font-family:'Newsreader',serif;font-weight:500;font-size:18px;margin:0 0 10px">Embed a specific TikTok video</h3>
        <p style="font-size:12px;color:#6f6658;margin:0 0 10px">Paste a TikTok video URL (format <code>https://www.tiktok.com/@username/video/1234567890</code>) — renders the official embed below.</p>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="url" id="ttEmbedInput" class="domain-input" placeholder="https://www.tiktok.com/@.../video/...">
          <button class="domain-lookup-btn" id="ttEmbedBtn">Embed</button>
        </div>
        <div id="ttEmbedSlot" style="margin-top:14px"></div>
      </div>

      <div class="tld-note" style="margin-top:18px">
        <strong>Why no full inline feed?</strong> TikTok sends <code>X-Frame-Options: DENY</code> on shop.tiktok.com + tiktok.com main pages, so browsers block iframe embeds. The official TikTok Embed widget (used below) works per video. For full live trending data, the roadmap is: TikTok Trends API → pull trending video URLs per niche → render via embed widget loop.
      </div>
    </section>

    <!-- ========== SITE GENERATOR (Gemini → one-file HTML) ========== -->
    <section class="view" data-view="sitegen">
      <div class="view-section-hdr" style="margin-bottom:14px">
        <div>
          <h2>Site <span style="font-style:italic;color:#c0492a">Generator</span></h2>
          <div class="sub">Gemini 2.5 Flash writes a self-contained HTML / inline CSS+JS file from your brief. Saves to R2, returns public URL. ~$0.005 per generation.</div>
        </div>
        <span class="ed-meta" id="sgUserCount">checking…</span>
      </div>
      <div class="sg-wrap">
        <form class="sg-form" id="sgForm" onsubmit="return false">
          <div>
            <label>Site name *</label>
            <input id="sgName" placeholder="e.g. Settle Home Goods" required>
          </div>
          <div>
            <label>Niche / category</label>
            <input id="sgNiche" placeholder="e.g. home organization, tech accessories">
          </div>
          <div>
            <label>Brief — what should this site do? *</label>
            <textarea id="sgBrief" placeholder="A minimalist landing page for an e-commerce shop that sells modular drawer organizers. Hero with a calm 'find your peace in every corner' headline, 3-product feature grid below, customer story testimonials, sticky CTA bar, email capture footer. Editorial tone, warm cream + soft terracotta + sage accent palette." required></textarea>
          </div>
          <div>
            <label>Palette hints (click to add)</label>
            <div class="sg-palette-row" id="sgPalette">
              <span class="sg-palette-chip" style="background:#f4efe6" data-hex="#f4efe6" title="cream"></span>
              <span class="sg-palette-chip" style="background:#c0492a" data-hex="#c0492a" title="terracotta"></span>
              <span class="sg-palette-chip" style="background:#23201a" data-hex="#23201a" title="ink"></span>
              <span class="sg-palette-chip" style="background:#5d8c5a" data-hex="#5d8c5a" title="sage"></span>
              <span class="sg-palette-chip" style="background:#d99232" data-hex="#d99232" title="amber"></span>
              <span class="sg-palette-chip" style="background:#4a73c4" data-hex="#4a73c4" title="blue"></span>
              <span class="sg-palette-chip" style="background:#f7d3a0" data-hex="#f7d3a0" title="peach"></span>
              <span class="sg-palette-chip" style="background:#9b2d1b" data-hex="#9b2d1b" title="brick"></span>
            </div>
            <div class="sg-status" id="sgPaletteSel" style="margin-top:6px">No palette selected — designer picks.</div>
          </div>
          <button class="sg-go" id="sgGo">Generate site (~$0.005)</button>
          <div class="sg-status" id="sgStatus">Uses your saved <code style="color:#c0492a">GEMINI_API_KEY</code> · output saved to <code>mjb/sites/&lt;you&gt;/</code> in R2</div>
        </form>
        <div class="sg-preview" id="sgPreview">
          <div class="sg-preview-empty">
            <div style="font-size:54px;opacity:.4;margin-bottom:12px">◐</div>
            <div>Generated site preview will render here</div>
            <div style="margin-top:6px;font-size:10px">Click "Generate site" to start</div>
          </div>
        </div>
      </div>
      <div style="margin-top:18px">
        <div class="queue-hdr" style="border:0;padding:0;margin-bottom:8px">
          <h3>Your recent sites</h3>
        </div>
        <div class="sg-history" id="sgHistory">
          <div style="font-family:'JetBrains Mono';font-size:11px;color:#a89e8d">loading…</div>
        </div>
      </div>
    </section>

    <!-- ========== CONTENT DASHBOARD (unified chronological feed) ========== -->
    <section class="view" data-view="feed">
      <div class="view-section-hdr" style="margin-bottom:14px">
        <div>
          <h2>Content <span style="font-style:italic;color:#c0492a">Dashboard</span></h2>
          <div class="sub">Unified feed of everything generated across product / shop / research / video / 3D / edit pipelines · newest first</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d">${r2Uploads.length} assets · ${(r2BytesTotal/1024/1024).toFixed(0)}MB</div>
      </div>

      <div class="feed-filter-bar">
        <button class="feed-filter active" data-feed-filter="all">All</button>
        <button class="feed-filter" data-feed-filter="products">Products</button>
        <button class="feed-filter" data-feed-filter="videos">Videos</button>
        <button class="feed-filter" data-feed-filter="edits">Edits</button>
        <button class="feed-filter" data-feed-filter="logos">Logos</button>
        <button class="feed-filter" data-feed-filter="shops">Shops</button>
        <button class="feed-filter" data-feed-filter="research">Research</button>
        <span style="margin-left:auto;display:flex;gap:6px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d">Group:
          <select id="feedGroup" style="padding:4px 8px;border:1px solid #d8cfbe;border-radius:4px;font-family:inherit;font-size:11px">
            <option value="day">Day</option>
            <option value="kind">Kind</option>
            <option value="user">User</option>
            <option value="none">None</option>
          </select>
        </span>
      </div>

      ${(() => {
        // Group r2Uploads by day (default), enrich with kind classification
        const kindOf = (key) => key.startsWith('mjb/videos/') ? 'videos'
                              : key.startsWith('mjb/products/') ? 'products'
                              : key.startsWith('mjb/edits/') ? 'edits'
                              : key.startsWith('mjb/logos/') || key.startsWith('mjb/shops/clusters/') ? 'logos'
                              : key.startsWith('mjb/shops/') ? 'shops'
                              : key.startsWith('mjb/avatars/') ? 'avatars'
                              : key.startsWith('mjb/research/') ? 'research'
                              : 'other';
        const kindIcon = { videos:'🎬', products:'🖼', edits:'✂️', logos:'🅻', shops:'🎨', avatars:'🧱', research:'🧠', other:'📦' };
        const enriched = r2Uploads
          .filter(u => u.uploadedAt && !u.key.startsWith('mjb/views/') && !u.key.startsWith('PING'))
          .map(u => ({
            ...u,
            kind: kindOf(u.key),
            day: (u.uploadedAt || '').slice(0, 10),
            user: u.key.includes('/uploads/') ? u.key.split('/uploads/')[1]?.split('/')[0]
                : u.key.includes('/edits/') ? u.key.split('/edits/')[1]?.split('/')[0]
                : 'system',
            displayName: u.key.split('/').slice(-1)[0].replace(/\.[a-z0-9]+$/i, '').slice(0, 60),
            niche: u.key.split('/').length >= 3 ? u.key.split('/').slice(-2, -1)[0] : null,
          }))
          .sort((a,b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
        // Default group by day
        const days = {};
        for (const e of enriched) (days[e.day] ||= []).push(e);
        const dayKeys = Object.keys(days).sort((a,b) => b.localeCompare(a));
        return `<div class="feed-list" id="feedList">
          ${dayKeys.map(day => `
            <div class="feed-day-group" data-day="${esc(day)}">
              <div class="feed-day-hdr">${esc(day)} <span class="feed-day-count">${days[day].length} items</span></div>
              <div class="feed-day-items">
                ${days[day].map(e => {
                  const url = R2_PUBLIC_BASE + '/' + e.key;
                  const isImg = /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(e.key);
                  const isVid = /\.(mp4|webm|mov)$/i.test(e.key);
                  const thumb = isImg ? `<img src="${esc(url)}" loading="lazy">`
                              : isVid ? `<video src="${esc(url)}" muted preload="metadata" playsinline></video>`
                              : `<span class="feed-item-ext">${esc((e.key.split('.').pop() || '?').toUpperCase().slice(0,4))}</span>`;
                  return `<div class="feed-item" data-feed-kind="${esc(e.kind)}" data-key="${esc(e.key)}" data-url="${esc(url)}">
                    <div class="feed-item-thumb">${thumb}</div>
                    <div class="feed-item-meta">
                      <div class="feed-item-name" title="${esc(e.key)}">${kindIcon[e.kind] || '·'} ${esc(e.displayName)}</div>
                      <div class="feed-item-sub">
                        <span class="feed-item-kind">${esc(e.kind)}</span>
                        ${e.niche ? `<span class="feed-item-niche">${esc(e.niche)}</span>` : ''}
                        <span class="feed-item-by">by ${esc(e.user)}</span>
                        <span class="feed-item-bytes">${(e.bytes/1024).toFixed(0)}KB</span>
                        <span class="feed-item-time">${new Date(e.uploadedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
                      </div>
                    </div>
                    <div class="feed-item-actions">
                      <a href="${esc(url)}" target="_blank" rel="noopener" class="feed-act">↗</a>
                    </div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>`;
      })()}
    </section>

    <!-- ========== BRAND STUDIO ========== -->
    <section class="view" data-view="brand">
      <div class="view-section-hdr">
        <div>
          <h2>Shop <span style="font-style:italic;color:#c0492a">identities</span></h2>
          <div class="sub">${Object.keys(shopClusters).length} multi-category cluster shops · each spans multiple related niches under one brand</div>
        </div>
      </div>

      ${Object.keys(shopClusters).length ? `
      <div class="cluster-grid">
        ${Object.entries(shopClusters).map(([key, { concept, meta }]) => {
          const logo = meta.r2Url || `${R2_PUBLIC_BASE}/mjb/shops/clusters/${key}-mark.png`;
          const palette = (concept.colorPaletteHints || []).slice(0, 5).map(hex => {
            const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
            const lum=(0.299*r+0.587*g+0.114*b)/255;
            const fg = lum > 0.55 ? '#000' : '#fff';
            return `<span class="brand-sw" style="background:${esc(hex)};color:${fg}">${esc(hex)}</span>`;
          }).join('');
          const niches = concept._meta?.niches || meta.niches || [];
          return `
          <div class="cluster-card" data-lane="${esc(meta.lane || '')}">
            <div class="cluster-card-hd">
              <div class="cluster-card-logo"><img src="${esc(logo)}" alt="${esc(concept.shopName)}" loading="eager" decoding="async" onerror="this.style.opacity='.2'"></div>
              <div class="cluster-card-tag">${esc(meta.label || key)}</div>
            </div>
            <div class="cluster-card-body">
              <h3 class="brand-name">${esc(concept.shopName)}</h3>
              <p class="brand-tag">${esc(concept.shopTagline)}</p>
              <p style="font-size:12px;color:#6f6658;line-height:1.55;margin:8px 0 10px">${esc(concept.categoryPositioning || '')}</p>
              <div class="brand-pal">${palette}</div>
              <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:5px">
                ${niches.map(n => `<span class="cluster-niche-chip">${esc(nicheLabel(n))}</span>`).join('')}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:14px;padding-top:10px;border-top:1px dashed #ece5d7">
                <span class="brand-arch">${esc(concept.brandArchetype)}</span>
                <span style="font-size:11px;color:#6f6658">${esc(concept.typographyHint || '')} · ${esc(concept.voiceTone || '')}</span>
              </div>
            </div>
          </div>
        `;}).join('')}
      </div>
      ` : ''}

      <div class="brand-grid" style="display:none">
        ${Object.entries(shopConcepts).map(([nicheId, concept]) => {
          const logo = shopLogoIndex[nicheId];
          const logoFile = logo?.file ? r2Url(logo.file) : null;
          const palette = (concept.colorPaletteHints || []).slice(0, 5).map(hex => {
            const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
            const lum=(0.299*r+0.587*g+0.114*b)/255;
            const fg = lum > 0.55 ? '#000' : '#fff';
            return `<span class="brand-sw" style="background:${esc(hex)};color:${fg}">${esc(hex)}</span>`;
          }).join('');
          return `
          <div class="brand-card">
            <div class="brand-card-logo">${logoFile ? `<img src="${esc(logoFile)}" alt="${esc(concept.shopName)}" loading="eager" decoding="async" onerror="this.style.display='none';this.parentNode.insertAdjacentHTML('beforeend','<span style=&quot;color:#a89e8d;font-family:JetBrains Mono;font-size:11px&quot;>logo pending</span>');this.onerror=null">` : `<span style="color:#a89e8d;font-family:'JetBrains Mono';font-size:11px">logo pending</span>`}</div>
            <div class="brand-card-body">
              <div class="brand-row"><span style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#a89e8d;font-weight:700">Sells: ${esc(nicheLabel(nicheId))}</span></div>
              <h3 class="brand-name">${esc(concept.shopName)}</h3>
              <p class="brand-tag">${esc(concept.shopTagline)}</p>
              <div class="brand-row">
                <span class="brand-arch">${esc(concept.brandArchetype)}</span>
                <span style="font-size:11px;color:#6f6658">${esc(concept.typographyHint)} · ${esc(concept.voiceTone)}</span>
              </div>
              <div class="brand-pal">${palette}</div>
              <p class="brand-rationale">${esc(concept.archetypeReasoning || '')}</p>
            </div>
          </div>
        `;}).join('')}
      </div>
    </section>

    <!-- ========== CONTENT FORGE (real Remotion + canva-clone integration) ========== -->
    <section class="view" data-view="forge">
      <div class="view-section-hdr">
        <div>
          <h2>Content <span style="font-style:italic;color:#c0492a">Forge</span></h2>
          <div class="sub">Compose UGC from generated R2 assets. Motion via Remotion Studio · Static via canva-clone (fabric.js)</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d">
          <span id="forgeStatus">checking editors…</span>
        </div>
      </div>
      <div class="cf-tabs">
        <button class="cf-tab active" data-cf-tab="motion">🎬 Motion <span class="cf-tab-sub">Remotion · :3000</span></button>
        <button class="cf-tab" data-cf-tab="static">🎨 Static <span class="cf-tab-sub">canva-clone · :3001</span></button>
        <button class="cf-tab" data-cf-tab="library">▦ Asset library</button>
      </div>
      <div class="cf-pane active" data-cf-pane="motion">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <span class="ed-status-pill"><span class="ed-status-dot"></span><span id="motionStatusText">remotion.wardtechsystems.com</span></span>
          <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
            <button class="ed-btn-ghost" id="motionCopyUrl" title="Copy Remotion URL">⎘</button>
            <a class="ed-btn" href="https://remotion.wardtechsystems.com/" target="_blank" rel="noopener">Open ↗</a>
          </span>
        </div>
        <!-- Remotion Studio served over HTTPS via cloudflared named tunnel from this BBWADMIN box.
             Tunnel: remotion (UUID 438d8d02-...) -> http://localhost:3000.
             Started: cloudflared --config ~/.cloudflared/config-remotion.yml tunnel run remotion -->
        <div class="cf-iframe-shell ed-iframe-shell">
          <iframe class="cf-iframe" id="cfRemotion" src="https://remotion.wardtechsystems.com/" loading="lazy" allow="autoplay; clipboard-write; fullscreen" style="display:block !important"></iframe>
          <div class="cf-iframe-fallback" id="cfRemotionFallback">
            <div class="cf-fb-icon">🎬</div>
            <h3>Remotion not reachable at remotion.wardtechsystems.com</h3>
            <p>The cloudflared tunnel on BBWADMIN is down. Restart with: <code>cloudflared --config ~/.cloudflared/config-remotion.yml tunnel run remotion</code></p>
            <a class="cf-fb-link" href="https://remotion.wardtechsystems.com/" target="_blank">Open in new tab →</a>
          </div>
        </div>
        <div class="ed-foot">
          <span>✦ Programmatic video composition (React-based). Drag MJB-generated R2 videos into <code>&lt;Video src="..."&gt;</code> compositions. Project: <code>C:/Code/my-video/</code> · Local also at <code>http://localhost:3000</code></span>
        </div>
      </div>
      <div class="cf-pane" data-cf-pane="static">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <button class="cf-static-mode active" data-static-mode="local">Local (private)</button>
          <button class="cf-static-mode" data-static-mode="shared">Shared room</button>
          <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
            <input id="cfStaticRoomId" placeholder="room-id (leave blank to auto-generate)" style="padding:5px 10px;border:1px solid #d8cfbe;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:11px;width:200px;display:none">
            <button class="cf-static-share" id="cfStaticShare" style="display:none">⎘ Copy share link</button>
          </span>
        </div>
        <div class="cf-iframe-shell" style="height:calc(100vh - 250px);min-height:520px">
          <!-- tldraw works HTTPS inline + has native drag-image support + has shared/multiplayer
               rooms via /r/<roomId>. Replaces excalidraw + canva-clone. -->
          <iframe class="cf-iframe" id="cfStatic" src="https://www.tldraw.com/" loading="lazy" allow="clipboard-write; clipboard-read; fullscreen" style="display:block !important"></iframe>
        </div>
        <div style="margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#6f6658">
          ✦ Drop assets here: from Asset Library tab below, click any asset's <strong>"↗ Send to Static"</strong> button — URL goes to clipboard, then <code>Ctrl+V</code> in this iframe pastes the image. Shared rooms support multi-user real-time editing.
        </div>
      </div>
      <div class="cf-pane" data-cf-pane="library">
        <p style="margin:18px 0 12px;color:#6f6658">${r2Videos.length} videos + ${r2Images.length} images in shared R2. Click a card to act on it — Send to Static / Motion / Copy URL.</p>
        <div class="cf-asset-strip">
          ${r2Videos.slice(0, 16).map(a => {
            const url = R2_PUBLIC_BASE + '/' + a.key;
            return `<div class="cf-asset" data-url="${esc(url)}" data-key="${esc(a.key)}" data-kind="video" title="${esc(a.key)}">
              <video src="${esc(url)}" muted loop preload="metadata" playsinline></video>
              <span class="cf-asset-tag">${esc(a.key.split('/').slice(-2,-1)[0] || 'vid')}</span>
              <div class="cf-asset-overlay">
                <button class="cf-asset-act" data-asset-act="to-static" title="Send URL to Static (paste in tldraw with Ctrl+V)">→ Static</button>
                <button class="cf-asset-act" data-asset-act="to-motion" title="Send URL to Motion (Remotion R2-load)">→ Motion</button>
                <button class="cf-asset-act" data-asset-act="copy" title="Copy URL">⎘</button>
              </div>
            </div>`;
          }).join('')}
          ${r2Images.slice(0, 36).map(a => {
            const url = R2_PUBLIC_BASE + '/' + a.key;
            return `<div class="cf-asset" data-url="${esc(url)}" data-key="${esc(a.key)}" data-kind="image" title="${esc(a.key)}">
              <img src="${esc(url)}" loading="lazy">
              <span class="cf-asset-tag">${esc((a.key.split('/').slice(-2,-1)[0] || 'img').slice(0, 12))}</span>
              <div class="cf-asset-overlay">
                <button class="cf-asset-act" data-asset-act="to-static" title="Send URL to Static (paste in tldraw with Ctrl+V)">→ Static</button>
                <button class="cf-asset-act" data-asset-act="to-motion" title="Send URL to Motion (Remotion R2-load)">→ Motion</button>
                <button class="cf-asset-act" data-asset-act="copy" title="Copy URL">⎘</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>

    <!-- ========== LIBRARY (R2 browser) ========== -->
    <section class="view" data-view="library">
      <div class="lib-storage">
        <div class="lib-storage-hdr">
          <div class="lib-storage-icon">▦</div>
          <div>
            <div class="lib-storage-title">R2 object storage</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#6f6658">mjb-commerce-media bucket</div>
          </div>
          <div class="lib-storage-meta">${(r2BytesTotal/1024/1024/1024).toFixed(2)} GB / 10 GB · ${r2Count} objects</div>
        </div>
        <div class="lib-storage-bar"><div class="lib-storage-fill" style="width:${Math.min(100,(r2BytesTotal/1024/1024/1024/10*100)).toFixed(1)}%"></div></div>
      </div>
      <div class="lib-tabs" data-tab-group="lib">
        <button class="lib-tab active" data-tab="all">All <span style="font-family:'JetBrains Mono';opacity:.6;margin-left:4px">${r2Count}</span></button>
        <button class="lib-tab" data-tab="images">Images <span style="font-family:'JetBrains Mono';opacity:.6;margin-left:4px">${r2Images.length}</span></button>
        <button class="lib-tab" data-tab="videos">Videos <span style="font-family:'JetBrains Mono';opacity:.6;margin-left:4px">${r2Videos.length}</span></button>
        <button class="lib-tab" data-tab="docs">Documents <span style="font-family:'JetBrains Mono';opacity:.6;margin-left:4px">${r2Other.length}</span></button>
        <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
          <label class="lib-upload-btn" for="libUploadInput" id="libUploadLabel">⬆ Upload to shared gallery</label>
          <input type="file" id="libUploadInput" multiple style="display:none">
          <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d">Right-click to open · <span id="libShownCount">${r2Count}</span> shown</span>
        </div>
      </div>
      <div id="libUploadStatus" style="display:none;background:#fcf9f3;border:1px solid #ece5d7;border-radius:6px;padding:10px 14px;margin-bottom:10px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#23201a"></div>

      <!-- Right-click context menu (shared across library cards) -->
      <div class="ctx-menu" id="libCtxMenu" role="menu">
        <div class="ctx-item" data-act="open"><span class="ctx-item-icon">↗</span> Open in new tab</div>
        <div class="ctx-item" data-act="copy"><span class="ctx-item-icon">⎘</span> Copy URL</div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" data-act="edit"><span class="ctx-item-icon">✎</span> Edit photo (in-browser) <span style="margin-left:auto;font-size:10px;color:#a89e8d">Canvas</span></div>
        <div class="ctx-item" data-act="reuse"><span class="ctx-item-icon">✦</span> Reuse with new prompt <span style="margin-left:auto;font-size:10px;color:#a89e8d">Nano Banana</span></div>
        <div class="ctx-item" data-act="upscale"><span class="ctx-item-icon">⤢</span> Upscale 4× <span style="margin-left:auto;font-size:10px;color:#a89e8d">Real-ESRGAN</span></div>
        <div class="ctx-item" data-act="tag"><span class="ctx-item-icon">⌗</span> Edit tags · shop</div>
      </div>

      <!-- In-browser photo editor modal -->
      <div class="pe-backdrop" id="peBackdrop">
        <div class="pe-modal">
          <div class="pe-tools">
            <div class="pe-tool-grp">
              <div class="pe-tool-lbl">Crop</div>
              <button class="pe-tool" data-pe="crop-toggle">⌗ Toggle</button>
              <button class="pe-tool" data-pe="crop-apply">Apply</button>
              <button class="pe-tool" data-pe="crop-reset">Reset</button>
            </div>
            <div class="pe-tool-grp">
              <div class="pe-tool-lbl">Rotate</div>
              <button class="pe-tool" data-pe="rotate-l">↺ -90°</button>
              <button class="pe-tool" data-pe="rotate-r">↻ +90°</button>
              <button class="pe-tool" data-pe="flip-h">⇋ Flip H</button>
              <button class="pe-tool" data-pe="flip-v">⇅ Flip V</button>
            </div>
            <div class="pe-tool-grp">
              <div class="pe-tool-lbl">Filters</div>
              <label class="pe-slider"><span>Brightness</span><input type="range" min="0" max="200" value="100" data-pe="bri"></label>
              <label class="pe-slider"><span>Contrast</span><input type="range" min="0" max="200" value="100" data-pe="con"></label>
              <label class="pe-slider"><span>Saturate</span><input type="range" min="0" max="200" value="100" data-pe="sat"></label>
              <label class="pe-slider"><span>Sepia</span><input type="range" min="0" max="100" value="0" data-pe="sep"></label>
              <label class="pe-slider"><span>Blur (px)</span><input type="range" min="0" max="10" value="0" data-pe="blu"></label>
            </div>
            <div class="pe-tool-grp">
              <div class="pe-tool-lbl">Text overlay</div>
              <input class="pe-text-in" id="peTextIn" type="text" placeholder="text…">
              <select class="pe-text-color" id="peTextColor">
                <option value="#fcf9f3">cream</option>
                <option value="#23201a">ink</option>
                <option value="#c0492a">terracotta</option>
                <option value="#fff">white</option>
                <option value="#000">black</option>
              </select>
              <input type="range" min="14" max="120" value="48" id="peTextSize" title="size">
              <button class="pe-tool" data-pe="text-add">+ Add text layer</button>
            </div>
            <div class="pe-tool-grp">
              <button class="pe-save" data-pe="save">Save back to R2 ↑</button>
              <button class="pe-tool pe-tool-danger" data-pe="cancel">Cancel</button>
            </div>
          </div>
          <div class="pe-stage" id="peStage"><canvas id="peCanvas"></canvas></div>
        </div>
      </div>

      <!-- Tags editor modal -->
      <div class="tag-backdrop" id="tagBackdrop">
        <div class="tag-modal">
          <h3 style="font-family:'Newsreader',serif;font-weight:500;font-size:20px;margin:0 0 8px">Edit tags <span style="color:#c0492a;font-style:italic">· shop attribution</span></h3>
          <div class="tag-src" id="tagSrc"></div>
          <div style="margin:14px 0 8px;font-family:'JetBrains Mono';font-size:10px;letter-spacing:.5px;color:#a89e8d;text-transform:uppercase;font-weight:700">Current tags</div>
          <div class="tag-chips" id="tagChips"></div>
          <div style="margin-top:14px">
            <input class="domain-input" id="tagInput" placeholder="Add tag (e.g. settle, drawer, hero, lifestyle)" style="margin-bottom:8px">
            <div class="tag-suggestions" id="tagSuggestions"></div>
          </div>
          <div style="margin-top:18px;display:flex;gap:8px">
            <button class="reuse-go" id="tagSave">Save tags</button>
            <button class="reuse-cancel" id="tagCancel">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Reuse-with-prompt modal -->
      <div class="reuse-backdrop" id="reuseBackdrop">
        <div class="reuse-modal">
          <div class="reuse-preview" id="reusePreview"></div>
          <div class="reuse-body">
            <h3>Reuse with new prompt</h3>
            <div class="reuse-src" id="reuseSrc"></div>
            <textarea id="reusePrompt" placeholder="e.g. Place this product on a warm wooden desk in a sunlit home office, soft natural light, shallow depth of field, no people"></textarea>
            <div class="reuse-actions">
              <button class="reuse-go" id="reuseGo">Generate (~$0.04)</button>
              <button class="reuse-cancel" id="reuseCancel">Cancel</button>
            </div>
            <div class="reuse-status" id="reuseStatus">Uses your saved GEMINI_API_KEY · output saved to mjb/edits/&lt;you&gt;/...</div>
          </div>
        </div>
      </div>
      <div class="lib-grid" id="libGrid">
        ${r2Videos.map(a => `
          <div class="lib-card lib-card-video" data-type="videos" data-key="${esc(a.key)}" data-url="${esc(R2_PUBLIC_BASE + '/' + a.key)}" data-kind="video" onclick="event.preventDefault(); const v=this.querySelector('video'); if(v){v.paused?v.play():v.pause()}">
            <div class="lib-card-img" style="position:relative">
              <video src="${esc(R2_PUBLIC_BASE + '/' + a.key)}" muted loop preload="metadata" playsinline style="width:100%;height:100%;object-fit:cover"></video>
              <span class="asset-badge" style="background:rgba(192,73,42,.92)">VIDEO</span>
              <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.85);color:#000;display:flex;align-items:center;justify-content:center;font-size:14px;padding-left:3px;pointer-events:none">▶</span>
            </div>
            <div class="lib-card-body">
              <div class="lib-card-name" title="${esc(a.key)}">${esc(a.key.split('/').slice(-1)[0])}</div>
              <div class="lib-card-bytes">${(a.bytes/1024).toFixed(0)}KB · ${esc(a.key.split('/').slice(-2,-1)[0] || 'video')}</div>
            </div>
          </div>
        `).join('')}
        ${r2Images.map(a => `
          <div class="lib-card" data-type="images" data-key="${esc(a.key)}" data-url="${esc(R2_PUBLIC_BASE + '/' + a.key)}" data-kind="image">
            <div class="lib-card-img">
              <img src="${esc(R2_PUBLIC_BASE + '/' + a.key)}" alt="" loading="lazy">
              ${a.key.includes('shops') && !a.key.includes('concepts') ? '<span class="asset-badge" style="background:rgba(192,73,42,.92)">SHOP LOGO</span>' : a.key.includes('logos/lanes') ? '<span class="asset-badge" style="background:rgba(192,73,42,.92)">LANE LOGO</span>' : ''}
              <div class="lib-hover-actions">
                <button class="lib-hover-btn" data-lib-act="edit" title="Edit in canvas">✎ Edit</button>
                <button class="lib-hover-btn" data-lib-act="reuse" title="Reuse with prompt (Nano Banana)">✦ Reuse</button>
                <button class="lib-hover-btn" data-lib-act="upscale-2" title="Upscale 2× (Real-ESRGAN)">⤢ 2×</button>
                <button class="lib-hover-btn" data-lib-act="upscale-4" title="Upscale 4× (Real-ESRGAN)">⤢ 4×</button>
                <button class="lib-hover-btn" data-lib-act="tag" title="Edit tags">⌗</button>
              </div>
            </div>
            <div class="lib-card-body">
              <div class="lib-card-name" title="${esc(a.key)}">${esc(a.key.split('/').slice(-1)[0])}</div>
              <div class="lib-card-bytes">${(a.bytes/1024).toFixed(0)}KB</div>
            </div>
          </div>
        `).join('')}
        ${r2Other.map(a => `
          <div class="lib-card lib-card-doc" data-type="docs" data-key="${esc(a.key)}" data-url="${esc(R2_PUBLIC_BASE + '/' + a.key)}" data-kind="doc">
            <div class="lib-card-img" style="background:#fcf9f3;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:#6f6658">
              <div style="font-size:36px;color:#c0492a">${esc((a.key.split('.').pop() || '?').toUpperCase().slice(0,4))}</div>
              <div style="margin-top:6px;text-transform:uppercase;letter-spacing:1px">${esc(a.contentType?.split('/')[1] || 'file')}</div>
            </div>
            <div class="lib-card-body">
              <div class="lib-card-name" title="${esc(a.key)}">${esc(a.key.split('/').slice(-1)[0])}</div>
              <div class="lib-card-bytes">${(a.bytes/1024).toFixed(0)}KB</div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- ========== BILLING / USAGE ========== -->
    <section class="view" data-view="billing">
      <div class="view-section-hdr">
        <div>
          <h2>Billing <span style="font-style:italic;color:#c0492a">&amp; usage</span></h2>
          <div class="sub">Per-provider spend rollup · session-to-date · against budget-policy.json caps</div>
        </div>
        <button class="topbar-cta" style="margin-left:0;padding:7px 14px;font-size:12px" onclick="alert('Refresh: read latest from r2-uploads.json + provider scripts cost stamps')">↻ Refresh</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Replicate</span><span class="kpi-delta">live</span></div>
          <div class="kpi-val accent">${fmtCent(billing.replicateCost)}</div>
          <div class="kpi-sub">${(billing.buckets['mjb/products/']?.count||0)} img + ${(billing.buckets['mjb/videos/']?.count||0)} vid + ${(billing.buckets['mjb/avatars/']?.count||0)} 3D + ${(billing.buckets['mjb/shops/']?.count||0)+(billing.buckets['mjb/logos/lanes/']?.count||0)} logo · derived from R2 manifest</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>OpenAI</span><span class="kpi-delta">live</span></div>
          <div class="kpi-val good">${fmtCent(billing.openaiCost)}</div>
          <div class="kpi-sub">gpt-4o-mini · research + ${(billing.buckets['mjb/shops/concepts/']?.count||0)} shop concepts</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Gemini</span><span class="kpi-delta">live</span></div>
          <div class="kpi-val good">${fmtCent(billing.geminiCost)}</div>
          <div class="kpi-sub">gemini-2.5-flash · 30% of research files</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>RapidAPI</span><span class="kpi-delta">free tier</span></div>
          <div class="kpi-val good">$0.00</div>
          <div class="kpi-sub">Real-Time Amazon Data + Taobao DataHub · within free quotas</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Cloudflare R2</span><span class="kpi-delta">storage</span></div>
          <div class="kpi-val">${fmtCent(billing.r2GBmo)}/mo</div>
          <div class="kpi-sub">${r2Count} objects · ${(r2BytesTotal/1024/1024/1024).toFixed(2)} GB · $0.015/GB-mo</div>
        </div>
        <div class="kpi-tile">
          <div class="kpi-tile-hdr"><span>Total spend</span><span class="kpi-delta accent" style="color:#c0492a">USD · live</span></div>
          <div class="kpi-val accent">${fmtCent(billing.totalCost)}</div>
          <div class="kpi-sub">vs. global daily hard cap $${billing.hardCapGlobal} → ${(billing.totalCost/billing.hardCapGlobal*100).toFixed(1)}% used</div>
        </div>
      </div>

      <div class="two-col" style="margin-top:18px">
        <div class="queue-card">
          <div class="queue-hdr">
            <h3>Budget caps</h3>
            <span class="badge">config/mjb/budget-policy.json</span>
          </div>
          ${[
            { label: 'Per product (total)', cap: 5, used: 0.05, scope: 'discoveryMax + validationMax + mediaPrepMax' },
            { label: 'MJB Home Finds daily', cap: 20, used: 6.20, scope: 'lane-level' },
            { label: 'MJB Tech Finds daily',  cap: 20, used: 3.40, scope: 'lane-level' },
            { label: 'MJB Everyday Utility daily', cap: 20, used: 1.84, scope: 'lane-level' },
            { label: 'Global daily soft', cap: 25, used: 11.44, scope: 'all lanes combined' },
            { label: 'Global daily hard', cap: 50, used: 11.44, scope: 'emits cost.budget.exceeded' },
          ].map(b => {
            const pct = Math.min(100, (b.used / b.cap) * 100);
            const tier = pct >= 100 ? '#9b2d1b' : pct >= 80 ? '#c0492a' : pct >= 50 ? '#8a5a00' : '#2c7a3e';
            return `
            <div style="padding:10px 0;border-bottom:1px dashed #ece5d7">
              <div style="display:flex;justify-content:space-between;align-items:baseline">
                <div>
                  <div style="font-size:13px;font-weight:600;color:#23201a">${b.label}</div>
                  <div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;color:#a89e8d;margin-top:2px">${b.scope}</div>
                </div>
                <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${tier}">$${b.used.toFixed(2)}<span style="color:#6f6658;font-weight:400">/${b.cap}</span></div>
              </div>
              <div style="height:5px;background:#ece5d7;border-radius:2px;margin-top:6px;overflow:hidden">
                <div style="height:100%;background:${tier};width:${pct.toFixed(1)}%"></div>
              </div>
            </div>`;
          }).join('')}
        </div>

        <div class="queue-card">
          <div class="queue-hdr">
            <h3>Recent spend events</h3>
            <span class="badge">cost.recorded bus</span>
          </div>
          ${[
            { time: '00:00', op: 'video.generate · luma-ray-2', cost: 0.40 },
            { time: '00:01', op: 'video.generate · hailuo (minimax)', cost: 0.50 },
            { time: '03:38', op: 'image.generate · shop-logo lint-roller', cost: 0.06 },
            { time: '03:35', op: 'image.generate · shop-logo magnetic-charger', cost: 0.06 },
            { time: '03:33', op: 'concept.generate · gpt-4o-mini × 10 niches', cost: 0.011 },
            { time: '03:30', op: 'image.generate × 45 · flux-1.1-pro-ultra (top-5 batch)', cost: 2.70 },
            { time: '03:25', op: 'concept.generate · gemini-2.5-flash × 4 chains', cost: 0.0095 },
            { time: '03:20', op: 'research.generate · gpt-4o-mini × 4 chains', cost: 0.014 },
            { time: '03:15', op: 'image.generate × 30 · flux-1.1-pro-ultra (top-2)', cost: 1.80 },
            { time: '03:05', op: 'image.generate × 3 · hand-prompts · flux-1.1-pro-ultra', cost: 0.18 },
            { time: '02:50', op: 'amazon.search × 5 · real-time-amazon-data (RapidAPI)', cost: 0.00 },
          ].map(e => `
            <div style="display:grid;grid-template-columns:60px 1fr auto;gap:10px;padding:8px 0;border-bottom:1px dashed #ece5d7;font-size:12px">
              <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#a89e8d">${e.time}</span>
              <span>${esc(e.op)}</span>
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${e.cost > 0 ? '#c0492a' : '#6f6658'}">${e.cost > 0 ? '$' + e.cost.toFixed(3) : 'free'}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="domains-card">
        <div class="queue-hdr" style="border:0;padding:0;margin-bottom:6px">
          <h3>Cloudflare domain pricing</h3>
          <span class="badge">at-cost · no markup</span>
        </div>
        <p style="color:#6f6658;font-size:13px;margin:0">Cloudflare Registrar bills at wholesale (no renewal markup, no upsell). Subdomains are <strong>free</strong> once you own the parent zone — <code>ugc.wardtechsystems.com</code> costs $0 if <code>wardtechsystems.com</code> is in your CF account.</p>

        <div class="domain-input-row">
          <input class="domain-input" id="domainInput" placeholder="e.g. mjbcommerce.com  or  trendsight.ai" />
          <button class="domain-lookup-btn" id="domainLookupBtn">Estimate cost →</button>
        </div>
        <div class="domain-result" id="domainResult"></div>

        <table class="tld-table">
          <thead><tr><th>TLD</th><th>Year 1</th><th>Renewal</th><th style="text-align:right">Notes</th></tr></thead>
          <tbody>
            <tr data-tld=".com"><td>.com</td><td class="price">$10.44</td><td>$10.44/yr</td><td style="text-align:right;color:#6f6658">Most universal</td></tr>
            <tr data-tld=".net"><td>.net</td><td class="price">$11.18</td><td>$11.18/yr</td><td style="text-align:right;color:#6f6658">Tech / infrastructure feel</td></tr>
            <tr data-tld=".org"><td>.org</td><td class="price">$9.93</td><td>$9.93/yr</td><td style="text-align:right;color:#6f6658">Brand / org tone</td></tr>
            <tr data-tld=".dev"><td>.dev</td><td class="price">$14.06</td><td>$14.06/yr</td><td style="text-align:right;color:#6f6658">HSTS-only (HTTPS mandatory)</td></tr>
            <tr data-tld=".app"><td>.app</td><td class="price">$14.06</td><td>$14.06/yr</td><td style="text-align:right;color:#6f6658">HSTS-only · feels mobile</td></tr>
            <tr data-tld=".io"><td>.io</td><td class="price">$32.30</td><td>$32.30/yr</td><td style="text-align:right;color:#6f6658">Tech default · premium</td></tr>
            <tr data-tld=".ai"><td>.ai</td><td class="price">$79.00</td><td>$79.00/yr</td><td style="text-align:right;color:#6f6658">AI-tagged · pricey</td></tr>
            <tr data-tld=".co"><td>.co</td><td class="price">$26.74</td><td>$26.74/yr</td><td style="text-align:right;color:#6f6658">Short startup-y</td></tr>
            <tr data-tld=".xyz"><td>.xyz</td><td class="price">$11.66</td><td>$11.66/yr</td><td style="text-align:right;color:#6f6658">Cheap catch-all</td></tr>
            <tr data-tld=".tech"><td>.tech</td><td class="price">$11.04</td><td>$11.04/yr</td><td style="text-align:right;color:#6f6658">Niche tech vertical</td></tr>
            <tr data-tld=".shop"><td>.shop</td><td class="price">$32.30</td><td>$32.30/yr</td><td style="text-align:right;color:#6f6658">E-commerce signal</td></tr>
            <tr data-tld=".store"><td>.store</td><td class="price">$61.97</td><td>$61.97/yr</td><td style="text-align:right;color:#6f6658">Premium e-commerce</td></tr>
            <tr data-tld=".me"><td>.me</td><td class="price">$19.46</td><td>$19.46/yr</td><td style="text-align:right;color:#6f6658">Personal brand</td></tr>
            <tr data-tld=".live"><td>.live</td><td class="price">$25.18</td><td>$25.18/yr</td><td style="text-align:right;color:#6f6658">Creator / streaming</td></tr>
          </tbody>
        </table>

        <div class="tld-note">
          <strong>Subdomain (free):</strong> If <code>wardtechsystems.com</code> is already in your CF account, just add <code>ugc</code> as a CNAME → <code>mjb-content-forge.pages.dev</code> in the DNS panel. No extra cost. <a href="https://dash.cloudflare.com/?to=/:account/domains/register" target="_blank" rel="noopener" style="color:#c0492a;font-weight:600">Open CF Registrar →</a>
        </div>
      </div>
    </section>

    <!-- ========== Placeholders for AI Organizer / Scheduler / SEO ========== -->
    <section class="view" data-view="organizer">
      <div class="view-section-hdr" style="margin-bottom:14px">
        <div>
          <h2>AI <span style="font-style:italic;color:#c0492a">Organizer</span></h2>
          <div class="sub">▶ Start = creates a queued job · local <code>jobs-agent.mjs</code> picks it up + runs it · ■ Stop cancels</div>
        </div>
        <div id="jobsAgentStatus" class="jobs-agent-pill" title="Agent status">checking agent…</div>
      </div>

      <div class="jobs-panel" id="jobsPanel">
        <div class="jobs-panel-hdr">
          <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:18px">Live job queue <span id="jobsCount" style="color:#a89e8d;font-size:13px;font-weight:400;margin-left:4px"></span></h3>
          <button class="jobs-refresh" id="jobsRefresh">↻ Refresh</button>
        </div>
        <div class="jobs-list" id="jobsList">
          <div style="font-family:'JetBrains Mono';font-size:11px;color:#a89e8d">loading…</div>
        </div>
        <div class="tld-note" style="margin-top:8px">
          <strong>Run the agent</strong> on a machine that has your AI keys:
          <code style="background:#23201a;color:#fcf9f3;padding:3px 8px;border-radius:3px;display:inline-block;margin-top:4px;font-size:11px">node tools/jobs-agent.mjs --user you@example.com --pass '***'</code>
          (Or set <code>AUTH_USER</code> + <code>AUTH_PASS</code> env vars.) The agent polls every 5s, claims one queued job at a time, runs it locally, posts results back.
        </div>
      </div>
      <div class="org-grid">
        ${[
          { stage: 'Discover', icon: '⌕', title: 'Pull trends from RapidAPI', cost: '$0.00', est: '~2 min', cmd: 'node packages/capabilities/product-intelligence/scripts/pull-trends.mjs', desc: 'Re-pulls top 10 candidates per niche from Real-Time Amazon Data + Taobao DataHub. Updates mockups/real-trends/candidates.json.', safe: true },
          { stage: 'Discover', icon: '🧠', title: 'LLM research (Gemini + OpenAI)', cost: '~$0.025', est: '~3 min', cmd: 'node packages/capabilities/product-intelligence/scripts/research-with-openai.mjs && node packages/capabilities/product-intelligence/scripts/research-with-gemini.mjs', desc: 'Niche-level market sentiment, buying intent keywords, design concepts × 10 niches.' },
          { stage: 'Score', icon: '⚖', title: 'Score candidates', cost: '$0.00', est: '~5 sec', cmd: 'node packages/capabilities/product-scoring/scripts/score-candidates.mjs', desc: 'Applies mjb-scorecard-v1 (margin × demand × competition × supplier-quality) to every candidate. Outputs ranked list.' },
          { stage: 'Create', icon: '🖼', title: 'Generate product media (top N)', cost: '~$0.06/img', est: '~40s/img', cmd: 'node packages/capabilities/media-generation/scripts/batch-generate-from-candidates.mjs --top 5', desc: 'flux-1.1-pro-ultra: hero / lifestyle / before-after × top scored. Skips already-generated.' },
          { stage: 'Create', icon: '🎨', title: 'Generate multi-category shops', cost: '~$0.19', est: '~3 min', cmd: 'node packages/capabilities/media-generation/scripts/generate-shop-clusters.mjs', desc: 'Gemini concept + Replicate logo for 3 clusters (home / tech / utility). Auto-R2 to mjb/shops/clusters/.' },
          { stage: 'Create', icon: '🎬', title: 'Generate videos (all models)', cost: '~$1.65', est: '~5 min', cmd: 'node packages/capabilities/media-generation/scripts/generate-videos.mjs --all-models', desc: 'hailuo + luma + kling-pro + wan + veo-3-fast + sora-2 for the top drawer-organizer candidate. Veo includes audio.' },
          { stage: 'Create', icon: '🧱', title: 'Generate 3D avatar', cost: '~$0.30', est: '~2 min', cmd: 'node packages/capabilities/media-generation/scripts/generate-avatar.mjs', desc: 'Trellis text+image to GLB mesh. Auto-R2 to mjb/avatars/.' },
          { stage: 'Create', icon: '✂️', title: 'Edit a product image (Nano Banana)', cost: '~$0.04/edit', est: '~10s', cmd: 'node packages/capabilities/media-generation/scripts/generate-edit.mjs --r2-key mjb/products/<niche>/<file>.png --prompt "..."', desc: 'gemini-2.5-flash-image variant. Right-click any library image to do this from the UI.' },
          { stage: 'Operate', icon: '☁', title: 'Re-render + redeploy app', cost: '$0.00', est: '~45 sec', cmd: 'bash scripts/deploy-cf-pages.sh', desc: 'Rebakes cf-app.html with latest R2 manifest + KPIs + feed, ships to Cloudflare Pages.' },
          { stage: 'Operate', icon: '📊', title: 'Open scheduled-task monitor', cost: '$0.00', est: 'instant', cmd: 'schtasks /Query /FO LIST /V', desc: 'Inspect Windows scheduled tasks if you wired any of these to cron.' },
        ].map(p => `
          <div class="org-card" data-cmd="${esc(p.cmd)}" data-job-name="${esc(p.title)}">
            <div class="org-card-hd">
              <span class="org-stage">${esc(p.stage)}</span>
              <span class="org-est">${esc(p.est)} · ${esc(p.cost)}</span>
            </div>
            <h4 class="org-title">${p.icon} ${esc(p.title)}</h4>
            <p class="org-desc">${esc(p.desc)}</p>
            <code class="org-cmd">${esc(p.cmd)}</code>
            <div class="org-actions">
              <button class="org-start" data-org-action="start">▶ Start</button>
              <button class="org-copy" data-org-action="copy">Copy</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="tld-note" style="margin-top:16px">
        <strong>Why copy + paste, not a button that runs it?</strong> These pipelines hit your local AI keys (in <code>~/.claude/secrets/</code>) and your local node + Replicate quota. A Worker-side "Run" button is on the roadmap — wire <code>/api/run</code> with auth + KV-stored keys when ready.
      </div>
    </section>
    <section class="view" data-view="scheduler">
      <div class="view-section-hdr">
        <div>
          <h2>Scheduler · <span style="font-style:italic;color:#c0492a">Postiz</span></h2>
          <div class="sub">Open-source social scheduler · TikTok / Instagram / Facebook / X / LinkedIn / YouTube · self-hosted on jmint via Cloudflare Tunnel</div>
        </div>
        <div class="ed-header-actions">
          <span class="ed-status-pill"><span class="ed-status-dot"></span><span id="postizStatusText">postiz.wardtechsystems.com</span></span>
          <button class="ed-btn-ghost" id="postizCopyUrl" title="Copy Postiz URL">⎘</button>
          <a class="ed-btn" href="https://postiz.wardtechsystems.com/" target="_blank" rel="noopener">Open ↗</a>
        </div>
      </div>

      <div class="ed-tabs">
        <button class="ed-tab active" data-postiz-section="schedule">📅 Schedule</button>
        <button class="ed-tab" data-postiz-section="analytics">📊 Analytics</button>
        <button class="ed-tab" data-postiz-section="settings">⚙ Settings</button>
        <span class="ed-tab-spacer"></span>
        <span class="ed-meta">${navCounts.scheduler} queued · ${r2Videos.length} videos in library</span>
      </div>

      <div class="cf-iframe-shell ed-iframe-shell">
        <!-- Postiz now lives on HTTPS via postiz.wardtechsystems.com (CF Tunnel from jmint),
             which means it embeds inline — no mixed-content block, no launcher card needed. -->
        <iframe class="cf-iframe" id="cfPostiz" src="https://postiz.wardtechsystems.com/" loading="lazy" allow="clipboard-write; fullscreen" style="display:block !important"></iframe>
        <div class="cf-iframe-fallback" id="cfPostizFallback">
          <div class="cf-fb-icon">📅</div>
          <h3>Postiz not reachable at postiz.wardtechsystems.com</h3>
          <p>The cloudflared tunnel from jmint may be down. Check the docker compose status on jmint and the tunnel config.</p>
          <a class="cf-fb-link" href="https://postiz.wardtechsystems.com/" target="_blank">Open in new tab →</a>
        </div>
      </div>
      <div class="ed-foot">
        <span>✦ Drag MJB-generated videos from the <a href="#" data-go-view="library" style="color:#c0492a;font-weight:600">Library</a> into Postiz's media picker · OAuth your TikTok / Instagram / FB accounts once · schedule by lane</span>
      </div>

      <div style="display:none">
      </div>
    </section>
    <section class="view" data-view="settings">
      <div class="view-section-hdr">
        <div>
          <h2>Settings · <span style="font-style:italic;color:#c0492a">API keys</span></h2>
          <div class="sub">Per-account secret storage · keys are KV-scoped to your username (no cross-user visibility)</div>
        </div>
        <div id="signedInAs" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#6f6658;background:#fcf9f3;padding:6px 14px;border-radius:999px;border:1px solid #ece5d7">checking…</div>
      </div>

      <div class="domains-card" style="margin-top:0">
        <div class="queue-hdr" style="border:0;padding:0;margin-bottom:10px">
          <h3>Your AI provider keys</h3>
          <span class="badge">stored in Cloudflare KV · USER_SECRETS</span>
        </div>
        <p style="color:#6f6658;font-size:13px;margin:0 0 8px">Each user has independent key storage. Adding a key here does NOT affect any other account. Local gen scripts still read from <code>~/.claude/secrets/</code> on the machine they run on — this UI manages keys for any future Worker-side generation.</p>
        <div class="tld-note" style="margin:0 0 14px;background:#eef2ed;border-left-color:#5d8c5a">
          <strong>R2 gallery is shared.</strong> Both users upload to and see the same <code>mjb-commerce-media</code> bucket via the Library view. Per-upload metadata records who uploaded each file (<code>customMetadata.uploadedBy</code>), but visibility is intentionally not gated.
        </div>
        <div id="keyForm" style="display:flex;flex-direction:column;gap:10px">
          <div style="color:#a89e8d;font-family:'JetBrains Mono',monospace;font-size:11px">loading…</div>
        </div>
      </div>

      <div class="domains-card">
        <div class="queue-hdr" style="border:0;padding:0;margin-bottom:8px">
          <h3>Account seats</h3>
          <span class="badge">live from /api/seats</span>
        </div>
        <table class="tld-table" id="seatsTable">
          <thead><tr><th>Seat</th><th>Username</th><th>Storage prefix</th></tr></thead>
          <tbody id="seatsTableBody"><tr><td colspan="3" style="color:#a89e8d">loading…</td></tr></tbody>
        </table>
        <div class="tld-note">
          Add more seats by setting <code>AUTH_USER_3</code> + <code>AUTH_PASS_3</code> via <code>npx wrangler pages secret put</code>. Middleware supports up to 3 by default; extend the array in <code>functions/_middleware.js</code> for more.
        </div>
      </div>

      <div class="domains-card">
        <div class="queue-hdr" style="border:0;padding:0;margin-bottom:8px">
          <h3>DNS records · wardtechsystems.com</h3>
          <span class="badge" id="dnsStatusBadge">requires CF_API_TOKEN</span>
        </div>
        <p style="color:#6f6658;font-size:13px;margin:0 0 12px">Live read of DNS records via Cloudflare API. To enable Read/Add, set <code>CF_API_TOKEN</code> (Zone:DNS:Edit scope) via <code>npx wrangler pages secret put CF_API_TOKEN</code>.</p>
        <div class="domain-input-row">
          <input class="domain-input" id="dnsZoneInput" placeholder="zone (e.g. wardtechsystems.com)" value="wardtechsystems.com">
          <button class="domain-lookup-btn" id="dnsLookupBtn">List records</button>
        </div>
        <div id="dnsList" style="margin-top:12px"></div>
        <details style="margin-top:14px">
          <summary style="cursor:pointer;font-size:12px;font-weight:600;color:#23201a">+ Add CNAME / A / TXT record</summary>
          <div style="display:grid;grid-template-columns:80px 1fr 1fr 80px;gap:6px;margin-top:10px">
            <select id="dnsAddType" class="domain-input">
              <option>CNAME</option><option>A</option><option>AAAA</option><option>TXT</option>
            </select>
            <input class="domain-input" id="dnsAddName" placeholder="subdomain (e.g. ugc)">
            <input class="domain-input" id="dnsAddContent" placeholder="target (e.g. mjb-content-forge.pages.dev)">
            <button class="domain-lookup-btn" id="dnsAddBtn">Add</button>
          </div>
          <div id="dnsAddStatus" style="margin-top:6px;font-family:'JetBrains Mono';font-size:11px;color:#6f6658"></div>
        </details>
      </div>
    </section>

    <section class="view" data-view="seo">
      <div class="view-section-hdr" style="margin-bottom:14px">
        <div>
          <h2>SEO <span style="font-style:italic;color:#c0492a">Tracking</span></h2>
          <div class="sub">Buying-intent + research-intent keywords per niche · sourced from LLM research files in mockups/real-trends/research/</div>
        </div>
      </div>
      ${(() => {
        // Pull keywords from trends-deep-dive.json if it exists
        const ddPath = path.join(DATA_DIR, 'research', 'trends-deep-dive.json');
        let dd = null;
        try { if (fs.existsSync(ddPath)) dd = JSON.parse(fs.readFileSync(ddPath, 'utf8')); } catch {}
        const niches = Object.keys(byNiche);
        if (!dd) {
          return `<div class="tld-note">No deep-dive research file yet. Run <code>node packages/capabilities/product-intelligence/scripts/research-with-openai.mjs</code> to generate, then re-deploy.</div>`;
        }
        return `<div class="seo-grid">
          ${niches.map(n => {
            const data = dd[n] || dd.results?.[n] || null;
            const kws = data?.topKeywordsByIntent || data?.keywords || {};
            const buying = kws.buying || kws.purchase || [];
            const research = kws.research || kws.informational || [];
            const compare = kws.comparison || kws.compare || [];
            const sent = data?.marketSentiment;
            return `<div class="seo-card">
              <div class="seo-card-hd">
                <h4>${esc(nicheLabel(n))}</h4>
                ${sent ? `<span class="brand-arch">${esc(sent)}</span>` : ''}
              </div>
              ${buying.length ? `<div class="seo-row"><div class="seo-row-lbl">🎯 Buying intent</div><div class="seo-tags">${buying.slice(0,6).map(k => `<span class="seo-tag seo-tag-buy">${esc(typeof k==='string'?k:k.term||k.keyword||'')}</span>`).join('')}</div></div>` : ''}
              ${research.length ? `<div class="seo-row"><div class="seo-row-lbl">🔍 Research</div><div class="seo-tags">${research.slice(0,6).map(k => `<span class="seo-tag seo-tag-res">${esc(typeof k==='string'?k:k.term||k.keyword||'')}</span>`).join('')}</div></div>` : ''}
              ${compare.length ? `<div class="seo-row"><div class="seo-row-lbl">⚖ Comparison</div><div class="seo-tags">${compare.slice(0,4).map(k => `<span class="seo-tag seo-tag-cmp">${esc(typeof k==='string'?k:k.term||k.keyword||'')}</span>`).join('')}</div></div>` : ''}
              ${!buying.length && !research.length && !compare.length ? `<div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#a89e8d">No keywords parsed from research file for this niche</div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      })()}
    </section>

  </div>
</div>

<script>
// Baked-in lookups (avoid extra fetches)
window.__R2_SITES__ = ${JSON.stringify(r2Sites)};

// View routing
const titles = {
  billing:   { kicker: 'Admin',           title: 'Billing & usage' },
  cmd:       { kicker: 'MJB Operations',  title: 'Command Center' },
  trends:    { kicker: 'Research',        title: 'Trends · Opportunity Scan' },
  brand:     { kicker: 'Create',          title: 'Brand Studio' },
  forge:     { kicker: 'Studio',          title: 'Content Forge' },
  organizer: { kicker: 'Create',          title: 'AI Organizer' },
  library:   { kicker: 'Storage',         title: 'Library' },
  scheduler: { kicker: 'Publish',         title: 'Scheduler' },
  seo:       { kicker: 'Publish',         title: 'SEO Tracking' },
  settings:  { kicker: 'Admin',           title: 'Settings · API keys' },
  feed:      { kicker: 'Workspace',       title: 'Content Dashboard' },
  tiktok:    { kicker: 'Research',        title: 'TikTok · Shop' },
  sitegen:   { kicker: 'Create',          title: 'Site Generator' },
};
function show(view) {
  document.querySelectorAll('.sb-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
  const t = titles[view] || titles.cmd;
  document.getElementById('viewKicker').textContent = t.kicker;
  document.getElementById('viewTitle').textContent = t.title;
}
document.querySelectorAll('.sb-item').forEach(i => i.addEventListener('click', () => show(i.dataset.view)));
document.querySelectorAll('.topbar-filter').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.topbar-filter').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
}));

// ===== Top search (Library view) =====
const topSearch = document.querySelector('.topbar-search input');
if (topSearch) {
  topSearch.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#libGrid .lib-card').forEach(c => {
      const name = (c.querySelector('.lib-card-name')?.textContent || '').toLowerCase();
      c.classList.toggle('hidden', q && !name.includes(q));
    });
    const visible = document.querySelectorAll('#libGrid .lib-card:not(.hidden):not([style*="display: none"])').length;
    const sc = document.getElementById('libShownCount');
    if (sc) sc.textContent = visible;
    // Auto-switch to library when typing
    if (q && !document.querySelector('[data-view="library"].view.active')) {
      document.querySelector('.sb-item[data-view="library"]')?.click();
    }
  });
}

// ===== Topbar filter pills (All / Home / Tech / Utility) — filter niche sections + leaderboard rows =====
document.querySelectorAll('.topbar-filter').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.topbar-filter').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const want = b.textContent.trim().toLowerCase(); // all | home | tech | utility
  const laneFor = want === 'home' ? 'mjb-home-finds' : want === 'tech' ? 'mjb-tech-finds' : want === 'utility' ? 'mjb-everyday-utility' : null;
  document.querySelectorAll('[data-lane]').forEach(el => {
    el.style.display = (!laneFor || el.dataset.lane === laneFor) ? '' : 'none';
  });
}));

// ===== New Generate modal =====
const modal = document.getElementById('newGenModal');
const newGenBtn = document.getElementById('newGenBtn');
const newGenClose = document.getElementById('newGenClose');
if (newGenBtn && modal) {
  newGenBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
  newGenClose.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.style.display = 'none'; });
  // Copy command to clipboard on option click
  document.querySelectorAll('.gen-opt').forEach(opt => opt.addEventListener('click', async () => {
    const code = opt.querySelector('code')?.textContent || '';
    try {
      await navigator.clipboard.writeText(code);
      opt.style.background = '#dceede';
      opt.querySelector('.gen-opt-title').textContent = '✓ Copied — paste in your terminal';
      setTimeout(() => modal.style.display = 'none', 1100);
    } catch {
      opt.querySelector('.gen-opt-title').textContent = 'Copy failed — select the command manually';
    }
  }));
}

// ===== Library tab filter (All / Images / Videos / Documents) =====
const libGrid = document.getElementById('libGrid');
if (libGrid) {
  document.querySelectorAll('[data-tab-group="lib"] .lib-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('[data-tab-group="lib"] .lib-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const target = t.dataset.tab;
    let shown = 0;
    libGrid.querySelectorAll('.lib-card').forEach(c => {
      const show = target === 'all' || c.dataset.type === target;
      c.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    const sc = document.getElementById('libShownCount');
    if (sc) sc.textContent = shown;
  }));
}

// ===== Sidebar toggle (mobile + desktop collapse) =====
const app = document.getElementById('app');
const sb = document.getElementById('sb');
const backdrop = document.getElementById('sbBackdrop');
const toggle = document.getElementById('sbToggle');
const isMobile = () => window.matchMedia('(max-width:1024px)').matches;
function openSb(){ sb.classList.add('open'); backdrop.classList.add('open'); }
function closeSb(){ sb.classList.remove('open'); backdrop.classList.remove('open'); }
function toggleCollapsed(){ app.classList.toggle('sb-collapsed'); try{localStorage.setItem('cf.sbCollapsed', app.classList.contains('sb-collapsed') ? '1' : '0')}catch{} }
toggle.addEventListener('click', () => { if (isMobile()) { sb.classList.contains('open') ? closeSb() : openSb(); } else { toggleCollapsed(); } });
backdrop.addEventListener('click', closeSb);
// Restore collapsed pref on desktop
try { if (!isMobile() && localStorage.getItem('cf.sbCollapsed') === '1') app.classList.add('sb-collapsed'); } catch {}
// Close mobile sidebar when nav clicked
document.querySelectorAll('.sb-item').forEach(i => i.addEventListener('click', () => { if (isMobile()) closeSb(); }));
// Reset state on resize across breakpoint
window.addEventListener('resize', () => { if (!isMobile()) closeSb(); });

// ===== Content Forge resizable panels =====
function attachResize(el, side){
  let dragging = false;
  el.addEventListener('mousedown', (e) => { dragging = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; e.preventDefault(); });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const editor = el.closest('.cf-editor');
    const r = editor.getBoundingClientRect();
    if (side === 'l') {
      const w = Math.max(180, Math.min(480, e.clientX - r.left));
      editor.style.setProperty('--cf-l', w + 'px');
    } else {
      const w = Math.max(180, Math.min(480, r.right - e.clientX));
      editor.style.setProperty('--cf-r', w + 'px');
    }
  });
  document.addEventListener('mouseup', () => { if (dragging) { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; } });
}
const cfL = document.getElementById('cfResizeL');
const cfR = document.getElementById('cfResizeR');
if (cfL) attachResize(cfL, 'l');
if (cfR) attachResize(cfR, 'r');

// ===== Content Forge tabs (Motion / Static / Library) =====
document.querySelectorAll('.cf-tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.cf-tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.cf-pane').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  const pane = document.querySelector('.cf-pane[data-cf-pane="' + t.dataset.cfTab + '"]');
  if (pane) pane.classList.add('active');
}));

// ===== Protocol detection — HTTPS deployments can't iframe http://localhost (mixed content) =====
const IS_HTTPS = location.protocol === 'https:';
if (IS_HTTPS) document.body.classList.add('is-https');

// On HTTP/file (i.e. user running cf-app.html locally), probe editors and show fallback if down.
// On HTTPS, skip probe — the launcher card is the canonical UI; iframe is hidden by CSS.
async function probeEditor(url, fallbackId, label) {
  if (IS_HTTPS) return; // launcher already visible; probing localhost from https is always blocked
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(2500) });
    document.getElementById(fallbackId)?.classList.remove('show');
  } catch (e) {
    document.getElementById(fallbackId)?.classList.add('show');
    const status = document.getElementById('forgeStatus');
    if (status) status.textContent = label + ' offline — see fallback';
  }
}
probeEditor('https://remotion.wardtechsystems.com/', 'cfRemotionFallback', 'Remotion');
probeEditor('http://localhost:3001/', 'cfCanvaFallback',    'canva-clone');
probeEditor('https://postiz.wardtechsystems.com/', 'cfPostizFallback', 'Postiz');
const _fs = document.getElementById('forgeStatus');
if (_fs) {
  if (IS_HTTPS) _fs.textContent = 'HTTPS · launch editors externally';
  else setTimeout(() => { if (_fs.textContent.includes('checking')) _fs.textContent = 'editors live'; }, 3500);
}

// ===== Domain pricing lookup (Cloudflare Registrar at-cost) =====
const TLD_PRICES = {
  '.com': 10.44, '.net': 11.18, '.org': 9.93,  '.dev': 14.06, '.app': 14.06,
  '.io':  32.30, '.ai':  79.00, '.co':  26.74, '.xyz': 11.66, '.tech': 11.04,
  '.shop': 32.30, '.store': 61.97, '.me': 19.46, '.live': 25.18, '.online': 32.30,
  '.site': 32.30, '.us': 9.15, '.uk': 7.07, '.de': 7.99, '.fr': 9.93, '.ca': 13.07,
};
const domainBtn = document.getElementById('domainLookupBtn');
const domainInput = document.getElementById('domainInput');
const domainResult = document.getElementById('domainResult');
function lookupDomain() {
  let raw = (domainInput?.value || '').trim().toLowerCase();
  // Strip protocol + www. without regex (avoids template-literal escape hell)
  if (raw.startsWith('https://')) raw = raw.slice(8);
  else if (raw.startsWith('http://')) raw = raw.slice(7);
  if (raw.startsWith('www.')) raw = raw.slice(4);
  raw = raw.replace(/[\\/?#].*$/, ''); // drop path/query — escaped for template-literal
  if (!raw || raw.indexOf('.') === -1) {
    if (domainResult) { domainResult.innerHTML = '<div style="color:#9b2d1b">Enter a domain like <code>example.com</code></div>'; domainResult.classList.add('show'); }
    return;
  }
  const dot = raw.lastIndexOf('.');
  const tld = '.' + raw.slice(dot + 1);
  const isSubdomain = raw.split('.').length >= 3;
  const labelPart = raw.split('.').slice(0, -1).join('.');
  const price = tld && TLD_PRICES[tld];
  let html = '';
  if (!tld) {
    html = '<div style="color:#9b2d1b">Unrecognized format. Try <code>example.com</code> or <code>shop.example.io</code>.</div>';
  } else if (isSubdomain) {
    const root = raw.split('.').slice(-2).join('.');
    html = '<div class="res-row"><span>Type</span><span>Subdomain</span></div>' +
           '<div class="res-row"><span>Root zone needed</span><span>' + root + '</span></div>' +
           '<div class="res-row"><span>Year 1</span><span style="color:#2c7a3e">$0.00 (free)</span></div>' +
           '<div class="res-row"><span>Renewal</span><span style="color:#2c7a3e">$0.00 (free)</span></div>' +
           '<div style="margin-top:8px;font-size:11px;color:#6f6658">If <code>' + root + '</code> is in your Cloudflare account, add the subdomain as a CNAME — no charge. If not, you must register the root zone first (see table below).</div>';
  } else if (!price) {
    html = '<div class="res-row"><span>TLD</span><span>' + tld + '</span></div>' +
           '<div style="color:#6f6658;margin-top:6px">No published wholesale price for ' + tld + ' in this table. Check live price at <a href="https://dash.cloudflare.com/?to=/:account/domains/register" target="_blank" style="color:#c0492a">CF Registrar →</a></div>';
  } else {
    html = '<div class="res-row"><span>Domain</span><span>' + raw + '</span></div>' +
           '<div class="res-row"><span>TLD</span><span>' + tld + '</span></div>' +
           '<div class="res-row"><span>Year 1 cost</span><span style="color:#c0492a">$' + price.toFixed(2) + '</span></div>' +
           '<div class="res-row"><span>Annual renewal</span><span style="color:#c0492a">$' + price.toFixed(2) + '/yr</span></div>' +
           '<div class="res-row"><span>5-year total</span><span>$' + (price * 5).toFixed(2) + '</span></div>' +
           '<div style="margin-top:8px;font-size:11px;color:#6f6658">Subdomains (e.g. <code>ugc.' + raw + '</code>, <code>app.' + raw + '</code>) are free once the zone is in your CF account. <a href="https://dash.cloudflare.com/?to=/:account/domains/register" target="_blank" style="color:#c0492a;font-weight:600">Register at CF →</a></div>';
  }
  domainResult.innerHTML = html;
  domainResult.classList.add('show');
}
if (domainBtn) {
  domainBtn.addEventListener('click', lookupDomain);
  domainInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') lookupDomain(); });
}
// Click TLD row → prefill input with example
document.querySelectorAll('.tld-table tr[data-tld]').forEach(tr => tr.addEventListener('click', () => {
  if (domainInput) { domainInput.value = 'example' + tr.dataset.tld; lookupDomain(); domainInput.focus(); domainInput.select(); }
}));

// ===== Settings · API keys (per-user, KV-backed via /api/secrets) =====
const KEY_DESCRIPTIONS = {
  REPLICATE_API_TOKEN:  { label: 'Replicate',  hint: 'r8_… · image (flux), video (kling/hailuo/luma/wan), 3D (trellis)' },
  OPENAI_API_KEY:       { label: 'OpenAI',     hint: 'sk-proj-… · gpt-4o-mini research + sora-2 video' },
  GEMINI_API_KEY:       { label: 'Gemini',     hint: 'AQ.… or AIza… · Veo 3, Imagen 4, Nano Banana edit' },
  RAPIDAPI_KEY:         { label: 'RapidAPI',   hint: 'hex32 · Amazon + Taobao trends data pulls' },
  DEEPSEEK_API_KEY:     { label: 'DeepSeek',   hint: 'sk-… · Anthropic-compat codegen endpoint' },
  R2_ACCOUNT_ID:        { label: 'R2 Account ID',        hint: 'Cloudflare account ID for R2 bucket access' },
  R2_ACCESS_KEY_ID:     { label: 'R2 Access Key ID',     hint: 'S3-compat API key' },
  R2_SECRET_ACCESS_KEY: { label: 'R2 Secret Access Key', hint: 'S3-compat secret' },
  R2_BUCKET:            { label: 'R2 Bucket name',       hint: 'e.g. mjb-commerce-media' },
};

async function loadSecrets() {
  const keyForm = document.getElementById('keyForm');
  const signedInAs = document.getElementById('signedInAs');
  const sbCount = document.getElementById('sbSettingsCount');
  if (!keyForm) return;
  try {
    const r = await fetch('/api/secrets', { cache: 'no-store' });
    if (!r.ok) {
      const detail = (await r.json().catch(()=>({}))).detail || ('HTTP ' + r.status);
      keyForm.innerHTML = '<div style="color:#9b2d1b;font-size:13px">Could not load: ' + detail + '</div>';
      if (signedInAs) signedInAs.textContent = 'KV not bound';
      return;
    }
    const data = await r.json();
    if (signedInAs) signedInAs.textContent = 'Signed in as: ' + data.user;
    const setCount = Object.values(data.keys || {}).filter(k => k.set).length;
    if (sbCount) sbCount.textContent = setCount + '/' + (data.knownKeys || []).length;
    const rows = (data.knownKeys || []).map(name => {
      const k = data.keys?.[name] || { set: false, last4: null };
      const meta = KEY_DESCRIPTIONS[name] || { label: name, hint: '' };
      return '<div class="key-row" data-name="' + name + '">' +
        '<div class="key-row-info"><div class="key-row-label">' + meta.label + ' <span class="key-row-name">' + name + '</span></div><div class="key-row-hint">' + meta.hint + '</div></div>' +
        '<div class="key-row-state">' +
          (k.set ? '<span class="key-set">✓ ' + (k.last4 || 'saved') + '</span>' : '<span class="key-empty">not set</span>') +
        '</div>' +
        '<input class="key-row-input" type="password" placeholder="' + (k.set ? 'replace value (or leave blank to clear)' : 'paste value') + '">' +
        '<button class="key-row-btn" data-action="save">Save</button>' +
        (k.set ? '<button class="key-row-btn key-row-btn-danger" data-action="clear">Clear</button>' : '') +
      '</div>';
    }).join('');
    keyForm.innerHTML = rows;
    keyForm.querySelectorAll('.key-row').forEach(row => {
      const name = row.dataset.name;
      const input = row.querySelector('.key-row-input');
      row.querySelectorAll('button[data-action]').forEach(btn => btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const value = action === 'clear' ? '' : input.value;
        btn.disabled = true; btn.textContent = '…';
        try {
          const resp = await fetch('/api/secrets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, value }),
          });
          if (resp.ok) { input.value = ''; await loadSecrets(); }
          else { btn.textContent = '✗'; }
        } catch { btn.textContent = '✗'; }
      }));
    });
  } catch (e) {
    keyForm.innerHTML = '<div style="color:#9b2d1b">Network error: ' + e.message + '</div>';
  }
}
loadSecrets();

// ===== Settings · Account seats live read =====
async function loadSeats() {
  const tbody = document.getElementById('seatsTableBody');
  if (!tbody) return;
  try {
    const r = await fetch('/api/seats');
    if (!r.ok) { tbody.innerHTML = '<tr><td colspan="3" style="color:#9b2d1b">load failed</td></tr>'; return; }
    const data = await r.json();
    tbody.innerHTML = (data.seats || []).map((u, i) => '<tr><td>' + (i+1) + '</td><td>' + u.replace(/</g,'&lt;') + '</td><td><code>user:' + u.replace(/</g,'&lt;') + ':*</code></td></tr>').join('');
  } catch { tbody.innerHTML = '<tr><td colspan="3" style="color:#9b2d1b">network error</td></tr>'; }
}
loadSeats();

// ===== Settings · DNS list + add (CF API) =====
async function loadDns() {
  const zone = document.getElementById('dnsZoneInput')?.value?.trim();
  const list = document.getElementById('dnsList');
  const badge = document.getElementById('dnsStatusBadge');
  if (!zone || !list) return;
  list.innerHTML = '<div style="font-family:JetBrains Mono;font-size:11px;color:#a89e8d">loading…</div>';
  try {
    const r = await fetch('/api/dns?zone=' + encodeURIComponent(zone));
    const data = await r.json();
    if (!r.ok) {
      if (badge) {
        badge.textContent = data.error === 'cf_api_failed' && /CF_API_TOKEN/.test(data.detail||'') ? 'CF_API_TOKEN not set' : (data.error || 'error');
        badge.style.background = '#fcf3ec'; badge.style.color = '#9b2d1b';
      }
      list.innerHTML = '<div style="color:#9b2d1b;font-size:12px">' + (data.error || 'failed') + ': ' + (data.detail || '').slice(0,300) + '</div>';
      return;
    }
    if (badge) { badge.textContent = data.records.length + ' records · ' + zone; badge.style.background = '#eef2ed'; badge.style.color = '#2c7a3e'; }
    list.innerHTML = '<table class="tld-table"><thead><tr><th>Type</th><th>Name</th><th>Content</th><th style="text-align:right">Proxied</th></tr></thead><tbody>' +
      data.records.map(rec => '<tr data-rec-id="' + rec.id + '"><td><code>' + rec.type + '</code></td><td>' + rec.name.replace(/</g,'&lt;') + '</td><td style="font-family:JetBrains Mono;font-size:11px;color:#6f6658">' + String(rec.content||'').slice(0,80).replace(/</g,'&lt;') + '</td><td style="text-align:right">' + (rec.proxied ? '<span style="color:#c0492a">●</span>' : '○') + '</td></tr>').join('') +
      '</tbody></table>';
  } catch (e) { list.innerHTML = '<div style="color:#9b2d1b">' + e.message + '</div>'; }
}
document.getElementById('dnsLookupBtn')?.addEventListener('click', loadDns);
document.getElementById('dnsZoneInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadDns(); });
document.getElementById('dnsAddBtn')?.addEventListener('click', async () => {
  const zone = document.getElementById('dnsZoneInput')?.value?.trim();
  const type = document.getElementById('dnsAddType')?.value;
  const name = document.getElementById('dnsAddName')?.value?.trim();
  const content = document.getElementById('dnsAddContent')?.value?.trim();
  const status = document.getElementById('dnsAddStatus');
  if (!zone || !type || !name || !content) { status.innerHTML = '<span style="color:#9b2d1b">All fields required</span>'; return; }
  status.textContent = 'adding…';
  try {
    const r = await fetch('/api/dns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone, type, name, content, proxied: type !== 'TXT' }),
    });
    const data = await r.json();
    if (r.ok) {
      status.innerHTML = '<span style="color:#2c7a3e">✓ Added ' + type + ' ' + name + ' → ' + content + '</span>';
      document.getElementById('dnsAddName').value = '';
      document.getElementById('dnsAddContent').value = '';
      loadDns();
    } else {
      status.innerHTML = '<span style="color:#9b2d1b">✗ ' + (data.error || '') + ': ' + (data.detail || '').slice(0,200) + '</span>';
    }
  } catch (e) { status.innerHTML = '<span style="color:#9b2d1b">' + e.message + '</span>'; }
});

// ===== Shared R2 upload (Library view) — both users write to mjb-commerce-media =====
const libUploadInput = document.getElementById('libUploadInput');
const libUploadLabel = document.getElementById('libUploadLabel');
const libUploadStatus = document.getElementById('libUploadStatus');
async function uploadFiles(files) {
  if (!files || !files.length) return;
  libUploadLabel?.classList.add('is-uploading');
  libUploadStatus.style.display = 'block';
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    libUploadStatus.textContent = 'Uploading ' + (i+1) + '/' + files.length + ' · ' + file.name + ' (' + (file.size/1024).toFixed(0) + ' KB)';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await r.json();
      results.push({ ok: r.ok, name: file.name, ...data });
    } catch (e) {
      results.push({ ok: false, name: file.name, error: e.message });
    }
  }
  libUploadLabel?.classList.remove('is-uploading');
  const okCount = results.filter(r => r.ok).length;
  const fails = results.filter(r => !r.ok);
  let msg = '<strong>✓ ' + okCount + '/' + results.length + ' uploaded to shared gallery</strong>';
  if (fails.length) msg += ' · <span style="color:#9b2d1b">' + fails.length + ' failed: ' + fails.map(f => f.name + ' (' + (f.error || f.detail || 'unknown') + ')').join(', ') + '</span>';
  msg += '<div style="font-size:11px;color:#6f6658;margin-top:4px">Reload the page to see new uploads in the gallery (manifest is regenerated on each render).</div>';
  libUploadStatus.innerHTML = msg;
  libUploadInput.value = '';
}
if (libUploadInput) {
  libUploadInput.addEventListener('change', (e) => uploadFiles(e.target.files));
}

// ===== Tiny toast (shared by ctx menu actions) =====
function _toast(msg, ms) {
  ms = ms || 2800;
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#23201a;color:#fcf9f3;padding:11px 22px;border-radius:8px;font-family:"JetBrains Mono",monospace;font-size:12px;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transition:opacity .25s;max-width:80vw';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, ms);
}

// ===== Library card hover actions (edit / reuse / upscale-2 / upscale-4 / tag) =====
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.lib-hover-btn');
  if (!btn) return;
  e.stopPropagation();
  const card = btn.closest('.lib-card');
  if (!card) return;
  const key = card.dataset.key;
  const url = card.dataset.url;
  const act = btn.dataset.libAct;
  if (act === 'edit') openPhotoEditor(key, url);
  else if (act === 'reuse') openReuseModal(key, url, 'image');
  else if (act === 'upscale-2') doUpscaleN(key, 2);
  else if (act === 'upscale-4') doUpscaleN(key, 4);
  else if (act === 'tag') openTagEditor(key);
});
async function doUpscaleN(key, scale) {
  _toast('Upscaling ' + scale + '× via Real-ESRGAN…');
  try {
    const r = await fetch('/api/upscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: key, scale }),
    });
    const data = await r.json();
    if (r.ok) {
      _toast('✓ Upscaled ' + scale + '× → ' + data.key.split('/').slice(-1)[0] + ' (reload to see)', 4500);
    } else {
      _toast('✗ Upscale failed: ' + (data.error || ''), 5000);
    }
  } catch (e) { _toast('✗ ' + e.message, 5000); }
}

// ===== Site Generator (Gemini one-file HTML) =====
const sgPaletteSelected = [];
document.querySelectorAll('#sgPalette .sg-palette-chip').forEach(chip => chip.addEventListener('click', () => {
  const hex = chip.dataset.hex;
  const i = sgPaletteSelected.indexOf(hex);
  if (i >= 0) { sgPaletteSelected.splice(i, 1); chip.classList.remove('active'); }
  else { sgPaletteSelected.push(hex); chip.classList.add('active'); }
  const sel = document.getElementById('sgPaletteSel');
  if (sel) sel.textContent = sgPaletteSelected.length ? ('Selected: ' + sgPaletteSelected.join(', ')) : 'No palette selected — designer picks.';
}));
const sgGo = document.getElementById('sgGo');
const sgStatus = document.getElementById('sgStatus');
const sgPreview = document.getElementById('sgPreview');
const sgHistory = document.getElementById('sgHistory');
async function loadSgHistory() {
  // List R2 objects under mjb/sites/<user>/ — we don't have a list API,
  // so derive from the global r2Uploads manifest baked into the page.
  // Most recent sites first.
  const u = document.getElementById('signedInAs')?.textContent?.replace('Signed in as: ', '') || '';
  const all = window.__R2_SITES__ || [];
  const mine = all.filter(s => s.key.includes('/sites/' + u + '/')).sort((a,b) => (b.uploadedAt||'').localeCompare(a.uploadedAt||''));
  if (!sgHistory) return;
  if (!mine.length) {
    sgHistory.innerHTML = '<div style="font-family:JetBrains Mono;font-size:11px;color:#a89e8d">No sites yet — generate your first above.</div>';
    return;
  }
  sgHistory.innerHTML = mine.slice(0, 12).map(s => {
    const name = s.key.split('/').slice(-1)[0].replace(/\\.html$/, '');
    return '<div class="sg-history-row" data-sg-url="' + s.publicUrl + '">' +
      '<div class="sg-history-name">' + name + '</div>' +
      '<div class="sg-history-meta">' + (s.bytes/1024).toFixed(0) + 'KB · ' + (s.uploadedAt||'').slice(0,10) + '</div>' +
    '</div>';
  }).join('');
  sgHistory.querySelectorAll('[data-sg-url]').forEach(row => row.addEventListener('click', () => {
    sgPreview.innerHTML = '<iframe src="' + row.dataset.sgUrl + '" style="width:100%;height:100%"></iframe>';
  }));
}
sgGo?.addEventListener('click', async () => {
  const name = document.getElementById('sgName').value.trim();
  const brief = document.getElementById('sgBrief').value.trim();
  const niche = document.getElementById('sgNiche').value.trim();
  if (!name) { sgStatus.innerHTML = '<span style="color:#9b2d1b">Need a site name</span>'; return; }
  if (!brief) { sgStatus.innerHTML = '<span style="color:#9b2d1b">Need a brief</span>'; return; }
  sgGo.disabled = true; sgGo.textContent = 'Generating…';
  sgStatus.textContent = 'Calling Gemini 2.5 Flash…';
  sgPreview.innerHTML = '<div class="sg-preview-empty"><div style="font-size:54px;animation:edPulse 1.4s infinite">◐</div><div>Generating…</div></div>';
  try {
    const r = await fetch('/api/site-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brief, niche, palette: sgPaletteSelected }),
    });
    const data = await r.json();
    if (r.ok) {
      sgStatus.innerHTML = '<span style="color:#2c7a3e">✓ Generated ' + data.slug + ' (' + (data.bytes/1024).toFixed(0) + 'KB, ' + (data.elapsedMs/1000).toFixed(1) + 's)</span> · <a href="' + data.publicUrl + '" target="_blank" style="color:#c0492a;font-weight:600">Open ↗</a>';
      sgPreview.innerHTML = '<iframe src="' + data.publicUrl + '" style="width:100%;height:100%"></iframe>';
      sgGo.disabled = false; sgGo.textContent = 'Generate another (~$0.005)';
    } else {
      sgStatus.innerHTML = '<span style="color:#9b2d1b">✗ ' + (data.error || 'failed') + ': ' + (data.detail || '').slice(0, 200) + '</span>';
      sgGo.disabled = false; sgGo.textContent = 'Retry';
      sgPreview.innerHTML = '<div class="sg-preview-empty"><div>Failed</div></div>';
    }
  } catch (e) {
    sgStatus.innerHTML = '<span style="color:#9b2d1b">✗ ' + e.message + '</span>';
    sgGo.disabled = false; sgGo.textContent = 'Retry';
  }
});

// ===== In-browser photo editor (Canvas — crop / rotate / filters / text) =====
// Free: pure browser canvas, save goes through /api/upload (R2 only, no AI cost)
const peBackdrop = document.getElementById('peBackdrop');
const peCanvas = document.getElementById('peCanvas');
const peStage = document.getElementById('peStage');
let peState = null; // { srcImg, rotation, flipH, flipV, filter, texts: [], cropRect, sourceKey }

function peApplyTransform() {
  if (!peState) return;
  const c = peCanvas, ctx = c.getContext('2d');
  const img = peState.srcImg;
  // Compute dimensions after rotation
  const r = peState.rotation % 360;
  const isSideways = (r === 90 || r === 270);
  const w = isSideways ? img.height : img.width;
  const h = isSideways ? img.width : img.height;
  c.width = w; c.height = h;
  ctx.save();
  ctx.filter = 'brightness(' + peState.bri + '%) contrast(' + peState.con + '%) saturate(' + peState.sat + '%) sepia(' + peState.sep + '%) blur(' + peState.blu + 'px)';
  ctx.translate(w/2, h/2);
  ctx.rotate(r * Math.PI / 180);
  ctx.scale(peState.flipH ? -1 : 1, peState.flipV ? -1 : 1);
  ctx.drawImage(img, -img.width/2, -img.height/2);
  ctx.restore();
  // Draw text overlays
  ctx.save();
  ctx.filter = 'none';
  for (const t of peState.texts) {
    ctx.fillStyle = t.color;
    ctx.font = t.size + 'px "Newsreader", Georgia, serif';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
  // Crop overlay (visual only — apply on Apply button)
  if (peState.cropRect) {
    ctx.save();
    ctx.strokeStyle = '#c0492a';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(peState.cropRect.x, peState.cropRect.y, peState.cropRect.w, peState.cropRect.h);
    ctx.restore();
  }
}

async function openPhotoEditor(sourceKey, sourceUrl) {
  peState = { sourceKey, sourceUrl, rotation: 0, flipH: false, flipV: false, bri: 100, con: 100, sat: 100, sep: 0, blu: 0, texts: [], cropRect: null, cropping: false };
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    peState.srcImg = img;
    peApplyTransform();
    peBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Reset sliders
    document.querySelectorAll('.pe-slider input').forEach(s => {
      const k = s.dataset.pe;
      s.value = peState[k];
    });
  };
  img.onerror = () => _toast('Image failed to load (CORS?)', 4000);
  img.src = sourceUrl;
}

function peClose() {
  peBackdrop?.classList.remove('open');
  document.body.style.overflow = '';
  peState = null;
}

// Sliders
document.querySelectorAll('.pe-slider input').forEach(s => s.addEventListener('input', () => {
  if (!peState) return;
  peState[s.dataset.pe] = parseFloat(s.value);
  peApplyTransform();
}));

// Tool buttons
peBackdrop?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-pe]');
  if (!btn) return;
  const action = btn.dataset.pe;
  if (!peState && action !== 'cancel') return;
  if (action === 'cancel') { peClose(); return; }
  if (action === 'rotate-l') peState.rotation = (peState.rotation + 270) % 360;
  else if (action === 'rotate-r') peState.rotation = (peState.rotation + 90) % 360;
  else if (action === 'flip-h') peState.flipH = !peState.flipH;
  else if (action === 'flip-v') peState.flipV = !peState.flipV;
  else if (action === 'crop-toggle') { peState.cropping = !peState.cropping; peCanvas.classList.toggle('no-crop', !peState.cropping); _toast(peState.cropping ? 'Drag on canvas to set crop' : 'Crop cleared', 2000); peState.cropRect = null; }
  else if (action === 'crop-reset') { peState.cropRect = null; peState.cropping = false; }
  else if (action === 'crop-apply') {
    if (!peState.cropRect) { _toast('Drag a crop region first', 2400); return; }
    const r = peState.cropRect;
    const cropped = document.createElement('canvas');
    cropped.width = Math.abs(r.w); cropped.height = Math.abs(r.h);
    cropped.getContext('2d').drawImage(peCanvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    const img = new Image();
    img.onload = () => { peState.srcImg = img; peState.rotation = 0; peState.flipH = false; peState.flipV = false; peState.cropRect = null; peState.cropping = false; peApplyTransform(); };
    img.src = cropped.toDataURL('image/png');
    return;
  }
  else if (action === 'text-add') {
    const t = document.getElementById('peTextIn').value.trim();
    if (!t) { _toast('Type something first', 1800); return; }
    const color = document.getElementById('peTextColor').value;
    const size = parseInt(document.getElementById('peTextSize').value, 10);
    peState.texts.push({ text: t, color, size, x: peCanvas.width * 0.1, y: peCanvas.height * 0.85 });
    document.getElementById('peTextIn').value = '';
  }
  else if (action === 'save') {
    btn.disabled = true; btn.textContent = 'Saving…';
    const blob = await new Promise(r => peCanvas.toBlob(r, 'image/png'));
    const baseName = peState.sourceKey.split('/').slice(-1)[0].replace(/\.[a-z0-9]+$/i, '');
    const fd = new FormData();
    fd.append('file', blob, baseName + '-edited.png');
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await r.json();
      if (r.ok) { _toast('✓ Saved → ' + data.key, 4500); peClose(); }
      else { btn.disabled = false; btn.textContent = '✗ ' + (data.error || 'failed'); }
    } catch (ex) { btn.disabled = false; btn.textContent = '✗ ' + ex.message; }
    return;
  }
  peApplyTransform();
});

// Crop drag
let cropStart = null;
peCanvas?.addEventListener('mousedown', (e) => {
  if (!peState?.cropping) return;
  const r = peCanvas.getBoundingClientRect();
  const sx = peCanvas.width / r.width;
  const sy = peCanvas.height / r.height;
  cropStart = { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
});
peCanvas?.addEventListener('mousemove', (e) => {
  if (!cropStart || !peState?.cropping) return;
  const r = peCanvas.getBoundingClientRect();
  const sx = peCanvas.width / r.width;
  const sy = peCanvas.height / r.height;
  const x2 = (e.clientX - r.left) * sx;
  const y2 = (e.clientY - r.top) * sy;
  peState.cropRect = { x: cropStart.x, y: cropStart.y, w: x2 - cropStart.x, h: y2 - cropStart.y };
  peApplyTransform();
});
peCanvas?.addEventListener('mouseup', () => { cropStart = null; });

// ===== Photo tags editor (no API cost — uses /api/secrets KV slot prefix) =====
const tagBackdrop = document.getElementById('tagBackdrop');
let tagState = null;
async function openTagEditor(sourceKey) {
  tagState = { sourceKey, tags: [] };
  document.getElementById('tagSrc').textContent = sourceKey;
  // Server-side fetch from /api/tags first (cross-user visibility),
  // fall back to localStorage cache for instant render before fetch returns
  const cached = localStorage.getItem('tags:' + sourceKey);
  if (cached) { try { tagState.tags = JSON.parse(cached); } catch {} }
  renderTagChips();
  try {
    const r = await fetch('/api/tags?key=' + encodeURIComponent(sourceKey));
    if (r.ok) {
      const data = await r.json();
      tagState.tags = data.tags || [];
      renderTagChips();
    }
  } catch {}
  // Suggestions from nicheLabel mapping + cluster names
  const suggests = ['settle','align','pebble','hero','lifestyle','before-after','tiktok','instagram','feature','retired'];
  document.getElementById('tagSuggestions').innerHTML = suggests.map(s => '<button class="tag-suggest" data-suggest="' + s + '">+ ' + s + '</button>').join('');
  tagBackdrop.classList.add('open');
  document.getElementById('tagInput').focus();
}
function renderTagChips() {
  const el = document.getElementById('tagChips');
  if (!tagState) return;
  el.innerHTML = tagState.tags.length ? tagState.tags.map(t => '<span class="tag-chip">' + t.replace(/</g,'&lt;') + '<span class="tag-chip-x" data-tag-rm="' + t + '">×</span></span>').join('') : '<span style="color:#a89e8d;font-size:12px">no tags yet — add some below</span>';
}
function closeTagEditor() { tagBackdrop?.classList.remove('open'); tagState = null; }
tagBackdrop?.addEventListener('click', (e) => {
  if (e.target === tagBackdrop) closeTagEditor();
  const rm = e.target.closest('[data-tag-rm]');
  if (rm) { tagState.tags = tagState.tags.filter(t => t !== rm.dataset.tagRm); renderTagChips(); }
  const sug = e.target.closest('[data-suggest]');
  if (sug && !tagState.tags.includes(sug.dataset.suggest)) { tagState.tags.push(sug.dataset.suggest); renderTagChips(); }
});
document.getElementById('tagInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const v = e.target.value.trim().toLowerCase().replace(/\\s+/g,'-');
    if (v && !tagState.tags.includes(v)) { tagState.tags.push(v); renderTagChips(); }
    e.target.value = '';
  }
});
document.getElementById('tagCancel')?.addEventListener('click', closeTagEditor);
document.getElementById('tagSave')?.addEventListener('click', async () => {
  const saveBtn = document.getElementById('tagSave');
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
  // Local cache for instant feel
  localStorage.setItem('tags:' + tagState.sourceKey, JSON.stringify(tagState.tags));
  // Server-side R2 customMetadata
  try {
    const r = await fetch('/api/tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: tagState.sourceKey, tags: tagState.tags }),
    });
    const data = await r.json();
    if (r.ok) {
      _toast('✓ Saved ' + tagState.tags.length + ' tags · shared via R2 customMetadata');
      closeTagEditor();
    } else {
      _toast('✗ Server save failed: ' + (data.error || 'unknown') + ' (cached locally)', 5000);
      saveBtn.disabled = false; saveBtn.textContent = 'Save tags';
    }
  } catch (e) {
    _toast('✗ Network error: ' + e.message + ' (cached locally)', 5000);
    saveBtn.disabled = false; saveBtn.textContent = 'Save tags';
  }
});

// ===== TikTok embed widget =====
const ttEmbedBtn = document.getElementById('ttEmbedBtn');
const ttEmbedInput = document.getElementById('ttEmbedInput');
const ttEmbedSlot = document.getElementById('ttEmbedSlot');
function embedTikTok() {
  const url = (ttEmbedInput?.value || '').trim();
  // Backslashes eaten by template literal — double them so the regex literal survives
  const m = url.match(/tiktok\\.com\\/(?:@[^\\/]+\\/video|v)\\/(\\d+)/);
  if (!m) { ttEmbedSlot.innerHTML = '<div style="color:#9b2d1b;font-size:12px">Not a recognized TikTok video URL.</div>'; return; }
  const videoId = m[1];
  ttEmbedSlot.innerHTML = '<blockquote class="tiktok-embed" cite="' + url + '" data-video-id="' + videoId + '" style="max-width:605px;min-width:325px"><section></section></blockquote>';
  // Load TikTok embed script once
  if (!document.getElementById('ttEmbedJs')) {
    const s = document.createElement('script');
    s.id = 'ttEmbedJs';
    s.src = 'https://www.tiktok.com/embed.js';
    s.async = true;
    document.body.appendChild(s);
  } else {
    // Re-run the loader if script was already added
    if (window.tiktokEmbedLoad) window.tiktokEmbedLoad();
  }
}
if (ttEmbedBtn) {
  ttEmbedBtn.addEventListener('click', embedTikTok);
  ttEmbedInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') embedTikTok(); });
}

// ===== Image lightbox (cf-app — click any <img> to expand, same pattern as master view) =====
(function(){
  const lb = document.createElement('div');
  lb.id = 'imgLb2';
  lb.style.cssText = 'position:fixed;inset:0;background:rgba(20,18,14,.92);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px;cursor:zoom-out';
  lb.innerHTML = '<img id="lbImg2" style="max-width:96vw;max-height:92vh;border-radius:6px;box-shadow:0 32px 80px rgba(0,0,0,.6);background:#fcf9f3">' +
    '<div id="lbMeta2" style="position:absolute;top:18px;left:24px;color:#fcf9f3;font-family:JetBrains Mono,monospace;font-size:11px;max-width:60vw"></div>' +
    '<div id="lbClose2" style="position:absolute;top:18px;right:24px;color:#fcf9f3;font-size:22px;cursor:pointer;background:rgba(255,255,255,.12);width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center">✕</div>' +
    '<a id="lbOpen2" target="_blank" rel="noopener" style="position:absolute;bottom:20px;right:24px;color:#fcf9f3;font-family:inherit;font-size:12px;background:rgba(192,73,42,.9);padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:600">Open ↗</a>';
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('#lbImg2');
  const lbMeta = lb.querySelector('#lbMeta2');
  const lbOpen = lb.querySelector('#lbOpen2');
  function openLb(src, alt){
    lbImg.src = src; lbImg.alt = alt || '';
    lbMeta.textContent = alt || src.split('/').slice(-1)[0];
    lbOpen.href = src;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeLb(){ lb.style.display = 'none'; lbImg.src = ''; document.body.style.overflow = ''; }
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img || img.closest('#imgLb2') || img.closest('iframe')) return;
    // Skip tiny / icon images (logos in sidebar etc) — only expand reasonably-sized images
    if (img.width > 0 && img.width < 60) return;
    // Don't expand brand-card-logo images that are inside their own anchor link to the asset (those should open new tab on alt-click; click should still expand)
    e.preventDefault();
    openLb(img.currentSrc || img.src, img.alt);
  });
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.id === 'lbClose2' || e.target === lbImg) closeLb(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lb.style.display === 'flex') closeLb(); });
})();

// ===== AI Organizer — Start + Copy buttons, live jobs panel =====
async function jobsList() {
  try {
    const r = await fetch('/api/jobs', { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function jobCreate(name, command) {
  const r = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, command }),
  });
  return r.json();
}
async function jobCancel(id) {
  const r = await fetch('/api/jobs/' + id + '/cancel', { method: 'POST' });
  return r.json();
}
async function jobDelete(id) {
  await fetch('/api/jobs/' + id, { method: 'DELETE' });
}

function renderJobsList(data) {
  const list = document.getElementById('jobsList');
  const countEl = document.getElementById('jobsCount');
  if (!list) return;
  if (!data || !data.jobs?.length) {
    list.innerHTML = '<div style="font-family:JetBrains Mono;font-size:11px;color:#a89e8d">No jobs yet — hit ▶ Start on any pipeline below.</div>';
    if (countEl) countEl.textContent = '';
    return;
  }
  if (countEl) countEl.textContent = '· ' + data.count + ' total';
  list.innerHTML = data.jobs.slice(0, 20).map(j => {
    const dur = j.durationMs ? (j.durationMs/1000).toFixed(1) + 's' : (j.claimedAt ? 'running…' : '');
    return '<div class="jobs-row" data-job-id="' + j.id + '">' +
      '<div class="jobs-status ' + j.status + '">' + j.status + '</div>' +
      '<div class="jobs-name" title="' + (j.command||'').replace(/"/g,'&quot;') + '">' + (j.name||j.id) + '</div>' +
      '<div class="jobs-meta">' + dur + '</div>' +
      '<div class="jobs-row-act">' +
        (j.status === 'queued' || j.status === 'running'
          ? '<button class="jobs-row-btn" data-job-act="cancel" title="Cancel">✕</button>'
          : '<button class="jobs-row-btn" data-job-act="delete" title="Delete">🗑</button>') +
      '</div>' +
    '</div>';
  }).join('');
}

async function refreshJobs() {
  const data = await jobsList();
  renderJobsList(data);
  // Update card-button states: if any job is running with same name, mark its Start button busy
  if (data?.jobs) {
    const busy = new Set(data.jobs.filter(j => j.status === 'queued' || j.status === 'running').map(j => j.name));
    document.querySelectorAll('.org-card').forEach(c => {
      const btn = c.querySelector('.org-start');
      if (!btn) return;
      if (busy.has(c.dataset.jobName)) {
        btn.classList.add('is-running');
        btn.textContent = '● Running';
        btn.disabled = true;
      } else {
        btn.classList.remove('is-running', 'is-queued');
        btn.textContent = '▶ Start';
        btn.disabled = false;
      }
    });
  }
  // Agent online heuristic: if any job ran in the last 60s, agent is alive
  const agentPill = document.getElementById('jobsAgentStatus');
  if (agentPill && data?.jobs?.length) {
    const recent = data.jobs.find(j => j.finishedAt && (Date.now() - new Date(j.finishedAt).getTime()) < 60000);
    const running = data.jobs.find(j => j.status === 'running');
    if (running) { agentPill.textContent = '● agent running job'; agentPill.className = 'jobs-agent-pill is-online'; }
    else if (recent) { agentPill.textContent = '● agent online'; agentPill.className = 'jobs-agent-pill is-online'; }
    else { agentPill.textContent = '○ agent idle/offline?'; agentPill.className = 'jobs-agent-pill'; }
  } else if (agentPill) {
    agentPill.textContent = 'no jobs yet';
    agentPill.className = 'jobs-agent-pill';
  }
}
refreshJobs();
setInterval(refreshJobs, 5000);

document.getElementById('jobsRefresh')?.addEventListener('click', refreshJobs);

// Jobs list — cancel/delete row buttons
document.getElementById('jobsList')?.addEventListener('click', async (e) => {
  const row = e.target.closest('[data-job-id]');
  const btn = e.target.closest('[data-job-act]');
  if (!row || !btn) return;
  const id = row.dataset.jobId;
  const act = btn.dataset.jobAct;
  if (act === 'cancel') { await jobCancel(id); refreshJobs(); }
  else if (act === 'delete') { await jobDelete(id); refreshJobs(); }
});

// AI Organizer cards — Start + Copy
document.querySelectorAll('.org-card .org-start').forEach(btn => btn.addEventListener('click', async (e) => {
  e.stopPropagation();
  const card = btn.closest('.org-card');
  const name = card.dataset.jobName;
  const cmd = card.dataset.cmd;
  btn.disabled = true; btn.textContent = '… queueing';
  const r = await jobCreate(name, cmd);
  if (r?.ok) {
    btn.classList.add('is-queued');
    btn.textContent = '✓ Queued';
    _toast('Queued: ' + name + ' — agent will pick it up next');
    setTimeout(refreshJobs, 500);
  } else {
    btn.disabled = false; btn.textContent = '✗ ' + (r?.error || 'failed');
    setTimeout(() => { btn.textContent = '▶ Start'; }, 3000);
  }
}));
document.querySelectorAll('.org-card .org-copy').forEach(btn => btn.addEventListener('click', async (e) => {
  e.stopPropagation();
  const cmd = btn.closest('.org-card').dataset.cmd;
  try {
    await navigator.clipboard.writeText(cmd);
    btn.classList.add('is-copied'); btn.textContent = '✓';
    setTimeout(() => { btn.classList.remove('is-copied'); btn.textContent = 'Copy'; }, 1800);
  } catch { _toast('Clipboard blocked: ' + cmd.slice(0, 80), 5000); }
}));

// ===== Content Dashboard filter pills =====
document.querySelectorAll('.feed-filter').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.feed-filter').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const f = b.dataset.feedFilter;
  document.querySelectorAll('#feedList .feed-item').forEach(item => {
    item.style.display = (f === 'all' || item.dataset.feedKind === f) ? '' : 'none';
  });
  // Hide empty day groups
  document.querySelectorAll('#feedList .feed-day-group').forEach(g => {
    const visible = g.querySelectorAll('.feed-item:not([style*="display: none"])').length;
    g.style.display = visible ? '' : 'none';
  });
}));

// ===== Library right-click context menu (Open / Copy / Reuse / Upscale / Crop) =====
const ctxMenu = document.getElementById('libCtxMenu');
let ctxTargetKey = null, ctxTargetUrl = null, ctxTargetKind = null;
function openCtx(x, y, key, url, kind) {
  ctxTargetKey = key; ctxTargetUrl = url; ctxTargetKind = kind;
  ctxMenu.classList.add('open');
  // Clamp to viewport
  const r = ctxMenu.getBoundingClientRect();
  const maxX = window.innerWidth - r.width - 8;
  const maxY = window.innerHeight - r.height - 8;
  ctxMenu.style.left = Math.min(x, maxX) + 'px';
  ctxMenu.style.top  = Math.min(y, maxY) + 'px';
  // Disable items that don't apply to videos
  ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
    const act = item.dataset.act;
    const videoOnly = ['reuse','upscale','crop'].includes(act);
    if (videoOnly && kind !== 'image') item.classList.add('ctx-item-disabled');
    else item.classList.remove('ctx-item-disabled');
  });
}
function closeCtx() { ctxMenu.classList.remove('open'); }
document.addEventListener('click', closeCtx);
document.addEventListener('scroll', closeCtx, true);
window.addEventListener('resize', closeCtx);
document.addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.lib-card');
  if (!card) return;
  e.preventDefault();
  openCtx(e.clientX, e.clientY, card.dataset.key, card.dataset.url, card.dataset.kind);
});
ctxMenu.addEventListener('click', async (e) => {
  const item = e.target.closest('.ctx-item');
  if (!item || item.classList.contains('ctx-item-disabled')) return;
  const act = item.dataset.act;
  const key = ctxTargetKey, url = ctxTargetUrl, kind = ctxTargetKind;
  closeCtx();
  if (act === 'open') window.open(url, '_blank');
  else if (act === 'copy') {
    try { await navigator.clipboard.writeText(url); _toast('URL copied'); }
    catch { _toast('Clipboard blocked — URL: ' + url.slice(0, 60)); }
  }
  else if (act === 'reuse') openReuseModal(key, url, kind);
  else if (act === 'upscale') doUpscale(key);
  else if (act === 'edit') openPhotoEditor(key, url);
  else if (act === 'tag') openTagEditor(key);
});

// ===== Reuse-with-new-prompt modal (Nano Banana via /api/regen) =====
const reuseBackdrop = document.getElementById('reuseBackdrop');
const reusePreview = document.getElementById('reusePreview');
const reuseSrc = document.getElementById('reuseSrc');
const reusePrompt = document.getElementById('reusePrompt');
const reuseGo = document.getElementById('reuseGo');
const reuseCancel = document.getElementById('reuseCancel');
const reuseStatus = document.getElementById('reuseStatus');
let reuseTargetKey = null;
function openReuseModal(key, url, kind) {
  reuseTargetKey = key;
  reusePreview.innerHTML = kind === 'video'
    ? '<video src="' + url + '" muted loop autoplay playsinline></video>'
    : '<img src="' + url + '" alt="source">';
  reuseSrc.textContent = key;
  reusePrompt.value = '';
  reuseStatus.textContent = 'Uses your saved GEMINI_API_KEY · output saved to mjb/edits/<you>/...';
  reuseGo.disabled = false; reuseGo.textContent = 'Generate (~$0.04)';
  reuseBackdrop.classList.add('open');
  setTimeout(() => reusePrompt.focus(), 100);
}
function closeReuseModal() { reuseBackdrop.classList.remove('open'); }
reuseCancel?.addEventListener('click', closeReuseModal);
reuseBackdrop?.addEventListener('click', (e) => { if (e.target === reuseBackdrop) closeReuseModal(); });
reuseGo?.addEventListener('click', async () => {
  const prompt = reusePrompt.value.trim();
  if (!prompt) { reuseStatus.textContent = 'Enter a prompt first.'; reuseStatus.style.color = '#9b2d1b'; return; }
  reuseGo.disabled = true; reuseGo.textContent = 'Generating…';
  reuseStatus.style.color = '#6f6658'; reuseStatus.textContent = 'Calling Nano Banana…';
  try {
    const r = await fetch('/api/regen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: reuseTargetKey, prompt }),
    });
    const data = await r.json();
    if (r.ok) {
      reuseStatus.innerHTML = '<span style="color:#2c7a3e">✓ Saved to ' + data.key + '</span> · <a href="' + data.publicUrl + '" target="_blank" style="color:#c0492a;font-weight:600">Open</a> · reload page to see in gallery';
      reuseGo.textContent = 'Generate another';
      reuseGo.disabled = false;
    } else {
      reuseStatus.innerHTML = '<span style="color:#9b2d1b">✗ ' + (data.error || 'failed') + ': ' + (data.detail || '').slice(0,200) + '</span>';
      reuseGo.disabled = false; reuseGo.textContent = 'Retry';
    }
  } catch (e) {
    reuseStatus.innerHTML = '<span style="color:#9b2d1b">✗ Network error: ' + e.message + '</span>';
    reuseGo.disabled = false; reuseGo.textContent = 'Retry';
  }
});

// ===== Upscale via /api/upscale (Real-ESRGAN) =====
async function doUpscale(key) {
  _toast('Upscaling 4× via Real-ESRGAN…');
  try {
    const r = await fetch('/api/upscale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey: key, scale: 4 }),
    });
    const data = await r.json();
    if (r.ok) {
      _toast('✓ Upscaled → ' + data.key.split('/').slice(-1)[0] + ' (reload to see)', 4000);
    } else {
      _toast('✗ Upscale failed: ' + (data.error || ''), 5000);
    }
  } catch (e) { _toast('✗ ' + e.message, 5000); }
}

// ===== In-page crop — opens the photo editor with crop mode pre-toggled =====
function openCropModal(key, url) {
  openPhotoEditor(key, url);
  setTimeout(() => {
    if (peState) {
      peState.cropping = true;
      const cv = document.getElementById('peCanvas');
      if (cv) cv.classList.remove('no-crop');
      _toast('Drag on the canvas to set crop region → Apply commits, Save uploads to R2', 4500);
    }
  }, 220);
}
// Drag-drop on the lib-grid area
const libGridDropZone = document.getElementById('libGrid');
if (libGridDropZone) {
  ['dragenter','dragover'].forEach(ev => libGridDropZone.addEventListener(ev, (e) => { e.preventDefault(); libGridDropZone.style.outline = '2px dashed #c0492a'; libGridDropZone.style.outlineOffset = '4px'; }));
  ['dragleave','drop'].forEach(ev => libGridDropZone.addEventListener(ev, (e) => { e.preventDefault(); libGridDropZone.style.outline = ''; }));
  libGridDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length) uploadFiles(files);
  });
}

// ===== Asset → editor handoff (Static / Motion / Copy URL) =====
// Cross-origin iframe drag doesn't work cleanly — we use the clipboard
// + nudge the user to paste (Ctrl+V) inside the active editor tab.
document.querySelectorAll('.cf-asset').forEach(el => {
  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-asset-act]');
    if (!act) return;
    e.stopPropagation();
    const action = act.dataset.assetAct;
    const url = el.dataset.url;
    try { await navigator.clipboard.writeText(url); } catch {}
    if (action === 'copy') { _toast('URL copied'); return; }
    if (action === 'to-static') {
      // Switch to Static tab, focus iframe, prompt to paste
      document.querySelector('.cf-tab[data-cf-tab="static"]')?.click();
      _toast('URL copied → click the tldraw canvas and press Ctrl+V to paste', 5000);
      setTimeout(() => document.getElementById('cfStatic')?.focus(), 200);
    } else if (action === 'to-motion') {
      document.querySelector('.cf-tab[data-cf-tab="motion"]')?.click();
      _toast('URL copied → in Remotion Studio: drag into a <Video src="..."> composition', 5000);
    }
  });
});

// ===== Static editor: local vs shared (multiplayer) room toggle =====
const cfStatic = document.getElementById('cfStatic');
const cfStaticRoomInput = document.getElementById('cfStaticRoomId');
const cfStaticShareBtn = document.getElementById('cfStaticShare');
function loadStaticRoom(roomId) {
  if (!cfStatic) return;
  cfStatic.src = roomId ? ('https://www.tldraw.com/r/' + encodeURIComponent(roomId)) : 'https://www.tldraw.com/';
  if (roomId) {
    try { localStorage.setItem('cf.staticRoom', roomId); } catch {}
    if (cfStaticRoomInput) cfStaticRoomInput.value = roomId;
  } else {
    try { localStorage.removeItem('cf.staticRoom'); } catch {}
  }
}
document.querySelectorAll('.cf-static-mode').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.cf-static-mode').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const mode = b.dataset.staticMode;
  if (mode === 'shared') {
    if (cfStaticRoomInput) cfStaticRoomInput.style.display = '';
    if (cfStaticShareBtn) cfStaticShareBtn.style.display = '';
    let saved = '';
    try { saved = localStorage.getItem('cf.staticRoom') || ''; } catch {}
    if (!saved) {
      // Generate a memorable room id: mjb-<adj>-<noun>-<3digits>
      const adj = ['calm','warm','tidy','sleek','crisp','bright','snug','quiet'][Math.floor(Math.random()*8)];
      const noun = ['drawer','spice','cable','mount','shelf','lint','spot','room'][Math.floor(Math.random()*8)];
      saved = 'mjb-' + adj + '-' + noun + '-' + Math.floor(Math.random()*900+100);
    }
    loadStaticRoom(saved);
  } else {
    if (cfStaticRoomInput) cfStaticRoomInput.style.display = 'none';
    if (cfStaticShareBtn) cfStaticShareBtn.style.display = 'none';
    loadStaticRoom(null);
  }
}));
cfStaticRoomInput?.addEventListener('change', () => loadStaticRoom(cfStaticRoomInput.value.trim() || null));
// ===== Postiz header actions + sub-tab navigation =====
document.getElementById('postizCopyUrl')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('https://postiz.wardtechsystems.com/'); _toast('Postiz URL copied'); } catch {}
});
document.getElementById('motionCopyUrl')?.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText('https://remotion.wardtechsystems.com/'); _toast('Remotion URL copied'); } catch {}
});
document.querySelectorAll('[data-postiz-section]').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('[data-postiz-section]').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  const sec = t.dataset.postizSection;
  const f = document.getElementById('cfPostiz');
  if (!f) return;
  const targets = { schedule: '/', analytics: '/analytics', settings: '/settings' };
  f.src = 'https://postiz.wardtechsystems.com' + (targets[sec] || '/');
}));
document.querySelectorAll('[data-go-view]').forEach(el => el.addEventListener('click', (e) => {
  e.preventDefault();
  if (typeof show === 'function') show(el.dataset.goView);
}));

cfStaticShareBtn?.addEventListener('click', async () => {
  const id = cfStaticRoomInput?.value.trim();
  if (!id) { _toast('Set a room id first', 2200); return; }
  const link = 'https://www.tldraw.com/r/' + encodeURIComponent(id);
  try { await navigator.clipboard.writeText(link); _toast('Share link copied: ' + link, 4500); }
  catch { _toast('Link: ' + link, 5000); }
});
// Restore saved shared room on load
(function(){
  try {
    const saved = localStorage.getItem('cf.staticRoom');
    if (saved) {
      document.querySelector('.cf-static-mode[data-static-mode="shared"]')?.click();
    }
  } catch {}
})();
</script>
</body>
</html>
`;

fs.writeFileSync(OUT_HTML, html);
console.log(`wrote ${(html.length/1024).toFixed(1)}KB to ${OUT_HTML}`);
const up = await tryPutR2('mjb/views/cf-app.html', OUT_HTML);
console.log(up.ok ? `→ R2: ${up.publicUrl}` : `→ R2 upload failed: ${up.error}`);
