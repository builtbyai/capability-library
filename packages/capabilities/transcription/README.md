# transcription · _planned_

Audio/video → text chunks with speaker labels + timestamps. Bridges `media-processing` (audio variant) → `knowledge-index` (RAG over spoken content).

**Surfaces:** AudioUploadPanel, TranscriptViewer, SpeakerLabelEditor, TranscriptSearch, TranscriptExportButton
**Emits:** `transcription.requested`, `transcription.started`, `transcription.segment.created`, `transcription.completed`, `transcription.failed`
**Depends on:** intake-pipeline, knowledge-index

## Backends

Selected via `TRANSCRIPTION_BACKEND`:
- `whisper-cpp` — local C++ whisper, no network, GPU-optional
- `openai-whisper` — hosted whisper API (rate-limited, paid)
- `deepgram` — fastest paid option; best diarization
- `ollama-whisper` — local via the fleet-ollama service the user already runs

Backends are interchangeable via the same port. Cost/latency tradeoff lives at config, not in capability code.

## Chunks → knowledge-index

Transcript chunks extend `ChunkBase`. `knowledge-index` already subscribes to `chunk.created`-shaped events; transcription emits its own variant (`transcription.segment.created`) and a workflow chains them.
