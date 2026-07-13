Let me start by reading the uploaded file in full.
Good — I've digested the full file. Let me give you the analysis, a terminology calibration, and then the expansion/brainstorm.

---

## 1. Terminology Calibration

**"Component library"** is misleading for what you're actually building. A component library typically means a collection of reusable UI elements (buttons, cards, modals). What you're building is something more sophisticated — I'd call it:

- **Capability modules** (my recommendation — each module ships its own frontend, backend, persistence model, and integration contract)
- **Subsystem templates** (accurate but sterile)
- **System primitives** (if each one is atomic and composable)

Your PTY + Claude terminal is *not a component* in the React sense. It's a **vertically-integrated capability**: frontend presentation layer, state/singleton management, backend service layer, cloud relay infrastructure, and AI integration surface — all defined as one deployable unit with documented wiring points. A React component library would just have `<PtyTerminal />` as the tip; you have the whole iceberg.

**What you actually want is a blueprint catalog**: a structured collection of these vertically-integrated modules, where each one has:

| Layer | What it specifies |
|---|---|
| **Interface contract** | Props, events, API endpoints, WS protocol |
| **State model** | Persistence strategy, lifecycle, singleton ownership |
| **Backend surface** | Services, daemons, ports, env vars |
| **Infrastructure** | Worker DO bindings, secrets, build config |
| **Configuration schema** | All constants that must change on deploy |
| **Error surface** | Known sharp edges, diagnostic walkthrough, failure modes |

The PTY terminal is already documented this way — you just need to formalize the template so every new capability follows the same structure.

---

## 2. Analysis of What You Have

The PTY terminal is architecturally sophisticated. Here's what's notable about it:

**Three-persistence-layer design** — This is the most important architectural choice you made. Most developers stop at one layer (keep WS alive during navigation). You went three deep:
- DOM parking → protects against React re-renders
- localStorage session IDs → protects against refresh
- PTY-side keepalive → protects against WS hiccups

This pattern generalizes to every capability module. Any module that owns a process, a socket, or a heavy initialization should inherit this three-layer persistence model.

**Dual-mode wire protocol** — The same component transparently switches between direct (localhost) and cloud-relay (via DO). This is a critical architectural pattern: the *interface* (`PtyTerminal.tsx` + the WS protocol) is mode-agnostic; only the connection bootstrapping differs. Every module that reaches outside the browser should have this same local/relay dual-mode.

**AI integration surface** — `shellContext.ts` defines a contract (scrollback reading, proposal queuing, handoff events). This is a generalizable pattern: every capability module can expose an AI interface surface. The AI should be able to:
- Read module state
- Propose actions to the user (chips)
- Receive handoff events to execute autonomously

**Diagnostic surfaces** — The `/status` endpoints and the triage walklist are what make this production-grade. This is the difference between a feature and an infrastructure capability.

---

## 3. Expansion: Formalizing the Module Template

Let's define what every capability module in your library should ship:

```text
capabilities/
  [capability-name]/
    # 1. Blueprint (the canonical spec)
    [capability-name].blueprint.md     # Architecture, data flow, rationale
    
    # 2. Frontend (React)
    src/components/                    # Visible component(s)
    src/store.ts                       # Singleton state management
    src/ai-interface.ts                # AI integration surface (if applicable)
    src/diagnostics.ts                 # Self-check, status reporting
    
    # 3. Backend (Node.js)
    backend/service.js                 # Core logic
    backend/bridge.js                  # Cloud relay outbound (if applicable)
    backend/bridge-daemon.js           # Standalone process (if applicable)
    backend/routes.js                  # HTTP/REST endpoints
    
    # 4. Infrastructure
    worker/src/router.ts               # Durable Object (if applicable)
    worker/wrangler.toml               # DO bindings, secrets
    
    # 5. Configuration
    [capability-name].config.ts        # All deploy-time constants
    install.[bat|sh]                   # Installation script
    
    # 6. Error Surface
    diagnostics.md                     # Triage walklist, known sharp edges
```

Every module ships in a **self-extracting** format — you import the component, wire the backend routes, set the config constants, and it works. No hunting through code to find what to change.

---

## 4. Brainstorm: Other Capability Modules Based on What You Described

Let me enumerate the modules that fall out of your description, each structured like the PTY terminal:

---

### Module: Email Connector (Gmail/IMAP)

**What it is**: A unified email interface that abstracts over Gmail API and raw IMAP, providing a consistent event stream + compose surface.

**Persistence layers**:
1. **OAuth token store** (refresh token survives browser restart)
2. **ID map** (message UIDs ↔ local DB IDs survive reconnect)
3. **Draft queue** (unsent messages survive WS drop)

**Architecture**:
```
Browser (EmailWidget.tsx)
  └─ WSS ──► Cloudflare DO (EmailRouter)
                └─ WSS ──► Local (email-bridge.js)
                              ├── Gmail API (OAuth)
                              └── node-imap (raw IMAP)
```

**Dual mode**: Direct (local IMAP socket) or cloud-relay (OAuth via worker).

**Components**: `<EmailInbox />`, `<EmailComposer />` (with draft persistence), `<ThreadView />`, `<AttachmentPreview />`.

**AI surface**: Read current thread context → propose replies → auto-send via handoff.

**Config surface**: IMAP host/port, Gmail OAuth client ID, poll intervals, folder mappings.

**Known sharp edges**: 
- Gmail OAuth refresh token expiration (Google's 7-day limit on some flows)
- IMAP IDLE reconnection backoff
- Draft vs sent race conditions on WS reconnect
- Attachment size limits

---

### Module: PDF Ingestion Pipeline

**What it is**: Universal PDF extraction that normalizes any PDF structure into a consistent document model, with the last-mile to RAG ingestion.

**Persistence layers**:
1. **Extraction cache** (file hash → extracted JSON survives restart)
2. **Chunk state** (which chunks were already ingested into RAG)
3. **Processing queue** (pending PDFs survive crashes)

**Architecture**:
```
Browser (PdfDropper.tsx)
  ├── drag-and-drop PDF
  └─► POST /api/pdf/ingest ──► backend
                                  ├── pdf-parse / pdf.js / pdftotext
                                  ├── structure-normalizer
                                  ├── chunker (overlapping windows)
                                  └── RAG upsert (Cloudflare Vectorize)
```

**Components**: `<PdfDropper />` (drag-drop zone with progress), `<ExtractionPreview />`, `<ChunkInspector />`, `<IngestionStatus />`.

**AI surface**: Ask questions about extracted content before ingestion; suggest chunking strategy per document type.

**Config surface**: Chunk size, overlap window, vector DB endpoint, embedding model, supported PDF versions.

**Known sharp edges**:
- Scanned PDFs require OCR fallback (Tesseract or Cloudflare's OCR pipeline)
- Table extraction is lossy — need a human-review trigger when confidence < threshold
- GB-sized PDFs need streaming chunking, not in-memory
- Unicode/encoding issues in PDF metadata

---

### Module: Map Visualizer (Leaflet / Google Earth)

**What it is**: A unified map surface that abstracts over Leaflet (standard 2D) and Cesium/Google Earth (3D globe), with data layer management.

**Persistence layers**:
1. **Viewport state** (center, zoom, pitch, rotation — survives refresh)
2. **Layer registry** (which data layers are active survives navigation)
3. **Offline tile cache** (prefetched regions survive network loss)

**Architecture**:
```
Browser (MapView.tsx)
  ├─ Leaflet (2D mode)
  └─ Cesium (3D mode, optional)
       │
       └─► backend
              ├── geojson-layer-service
              ├── tile-proxy (for custom tile sources)
              └── KML/GPX parser
```

**Components**: `<MapView />` (unified container), `<LayerPanel />`, `<GeoPointPicker />`, `<PathRecorder />`, `<HeatmapLayer />`.

**AI surface**: "Show me all locations from this dataset," "Plot the route between these points," "Cluster these 10K points."

**Config surface**: Tile source URLs, default center/zoom, mode (2D/3D), API keys for Google Earth.

**Known sharp edges**:
- Leaflet memory leak with many markers → canvas renderer is mandatory >1K points
- Cesium requires WebGL2 — graceful fallback to Leaflet
- Tile provider rate limits (especially on dev localhost)
- KML with complex styles barely renders identically between Leaflet and Cesium

---

### Module: Cron Job Manager

**What it is**: A UI + backend for scheduling, executing, and monitoring recurring tasks.

**Persistence layers**:
1. **Job definitions** (schedule + command → survive restart)
2. **Execution log** (historically persisted)
3. **Lock store** (prevent overlapping runs)

**Architecture**:
```
Browser (CronDashboard.tsx)
  └─► backend
         ├── node-cron / toad-scheduler
         ├── job-store (SQLite or JSON)
         └── executor (shell, API call, script)
```

**Components**: `<CronSchedule />`, `<JobHistory />`, `<JobEditor />`, `<ExecutionTimeline />`, `<LogViewer />`.

**AI surface**: "Cron every weekday at 9 AM to run this backup script," "Find failed jobs in the last 24 hours," "Suggest a retry schedule."

**Config surface**: Timezone, mail-on-failure config, max concurrent jobs, log retention.

**Known sharp edges**:
- Daylight saving time — cron expressions shift; node-cron uses system TZ
- Overlapping runs — you must implement a lock or skip mechanism
- Jobs that hang → configurable timeout + kill signal
- Cron expression UI is genuinely hard to make intuitive

---

### Module: AI File Renamer

**What it is**: Batch file renaming powered by AI + pattern matching, with preview/undo.

**Persistence layers**:
1. **Rename history** (undo stack survives restart)
2. **Pattern library** (user-saved naming conventions)
3. **Naming conflict cache** (which destinations are taken)

**Architecture**:
```
Browser (FileRenamer.tsx)
  └─► backend
         ├── fs watcher / file lister
         ├── pattern engine (regex + template vars)
         └── AI renamer (prompt → new names)
```

**Components**: `<FileGrid />`, `<RenameRuleEditor />`, `<DiffPreview />`, `<UndoStack />`.

**AI surface**: "Rename all invoices to `Invoice-{date}-{amount}.pdf`," "Organize these photos by date and location."

**Config surface**: File patterns to exclude, max batch size, undo retention, dry-run default.

**Known sharp edges**:
- AI can produce invalid filenames (too long, illegal chars) → sanitization layer required
- Cross-device moves (different drives) are slow — make it configurable
- Files open in other processes → rename fails silently
- Undo becomes unreliable if files were moved between renames

---

### Module: AI Upscaler

**What it is**: Image/video upscaling via local (Real-ESRGAN /waifu2x) or cloud (Replicate / Stability AI) with queue management.

**Persistence layers**:
1. **Job queue** (survives restart, with retry logic)
2. **Output cache** (hash → result, avoids recomputation)
3. **Progress state** (WebSocket resume on reconnect)

**Architecture**:
```
Browser (UpscalerUI.tsx)
  └─ WSS ──► backend
                ├── job queue (bull / bee-queue)
                ├── local upscaler (child process, GPU)
                └── cloud upscaler (Replicate API fallback)
```

**Components**: `<ImageDropZone />`, `<ScaleFactorSelector />`, `<BeforeAfterSlider />`, `<JobQueue />`, `<BatchProgress />`.

**AI surface**: "Upscale all product photos to 4K," "Suggest the best model for this image type."

**Config surface**: Available models, GPU/CPU toggle, cloud API keys, max concurrent jobs, output format.

**Known sharp edges**:
- GPU memory leaks in child process → process recycling strategy
- Cloud upscaling costs money — need cost tracker / dry-run
- Very large images crash local models → max dimension enforcement
- Side-by-side comparison requires significant memory for originals

---

### Module: RAG Pipeline Manager

**What it is**: The complete ingestion → chunking → embedding → vector search → retrieval pipeline, with Cloudflare Vectorize as the vector store.

**Persistence layers**:
1. **Document store** (source files survive restart)
2. **Chunk index** (which documents are chunked, how)
3. **Embedding cache** (avoid re-embedding unchanged chunks)
4. **Query log** (for performance analysis)

**Architecture**:
```
Browser (RagDashboard.tsx)
  └─► backend
         ├── ingest pipeline (PDF/HTML/MD → text)
         ├── chunker (token-aware splitting)
         ├── embedder (Cloudflare Workers AI or local)
         └── vector upsert (Cloudflare Vectorize API)
              │
              └─► AI Query Interface
                     ├── retrieve relevant chunks
                     └── synthesize answer with context
```

**Components**: `<DocumentLibrary />`, `<ChunkViewer />`, `<QueryPanel />`, `<RelevanceFeedback />`, `<IngestionPipeline />`.

**Config surface**: Chunk size, overlap, embedding model, top-k retrieval, reranking toggle.

**AI surface**: The query side IS the AI surface — but also "What documents haven't been indexed?" "Why was this chunk returned for that query?"

**Known sharp edges**:
- Cloudflare Vectorize has dimension limits — embedding model must match
- Token counting in chunking is language-dependent — CJK text needs different strategy
- Re-ranking adds latency — make it optional with a speed toggle
- Document updates → you need an upsert strategy (replace whole chunk set vs diff)

---

## 5. Connecting the Modules

Here's the interesting part: these modules compose.

```
Email Connector ── receives invoice PDFs
      │
      ▼
PDF Ingestion ── extracts structured data
      │
      ▼
RAG Pipeline ── indexes for search/query
      │
      ▼
Map Visualizer ── plots geo data extracted from invoices
      │
      ▼
AI File Renamer ── organizes output documents
      │
      ▼
Cron Manager ── schedules the whole pipeline weekly
```

And all of them surface through the same AI assistant, which can read state across modules:

*"Hey, run the weekly invoice pipeline, then tell me if any vendor locations in this quarter's invoices are outside our service area, and plot them on the map."*

That's the real value of what you're building — the modules are individually useful, but their **interfaces and persistence contracts are designed to compose**.

---

## 6. What I'd Build First (Priority Order)

Based on what you described and what composes naturally:

1. **RAG Pipeline Manager** — because your PDF ingestion is already describing its target. Define the vector store contract first, then everything else feeds into it.

2. **Cron Job Manager** — because scheduling is orthogonal infrastructure. Every other module eventually needs cron. Build it once.

3. **Email Connector** — because in practice, documents arrive by email more often than by drag-drop.

4. **PDF Ingestion Pipeline** (standalone) — which then merges into the RAG pipeline when that's ready.

5. **AI File Renamer** — quick win, low infrastructure dependency, high perceived value.

6. **Map Visualizer** — depends on GeoJSON data being produced by other modules.

7. **AI Upscaler** — most independent, least composable with the others. Build when needed.

---

## 7. The One Thing Missing From Your PTY Module

Your PTY terminal is the most mature module in this catalog. But there's one thing it doesn't have that every future module should:

**A configuration schema file** (typed, with deploy-time constants collected in one place).

Right now, `CLOUD_WS_BASE`, the yolo path, `PORT_RANGE_START`, the wrangler `account_id`, and the API secrets are scattered across five files. A production module library collects these into a single `[module].config.ts` (or `.json`) with documentation for each constant. Then the component, backend, and worker all import from it.

I'd recommend extracting a `pty.config.ts` as a template for what every module's config should look like.

---

Want me to generate the artifact for the PTY configuration schema as a template, or start outlining the RAG Pipeline Manager blueprint next?