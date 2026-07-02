# transcription · diagnostics runbook

## Rung 1 — ffmpeg + backend

`ffmpeg -version` → exit 0. `ModelInvocation.ping` against configured `TRANSCRIPTION_BACKEND` returns 200.

## Rung 2 — smoke transcription

```bash
curl -X POST http://127.0.0.1:5109/api/transcription/jobs \
  -d '{"intakeObjectId":"<known-10s-audio>","backend":"whisper-cpp","model":"base.en"}'
```

Expect a `jobId`. Poll `GET /api/transcription/jobs/:id` until `status:'completed'`. `listSegments(jobId)` should return ≥ 1 segment with non-empty text.

## Rung 3 — knowledge-index handoff

After a completed job, `knowledge-index/index-status.vectors` should have grown by the chunk count. If unchanged, the `chunk.created` events aren't being subscribed to.

## Symptom → cause

| Symptom | Cause |
|---|---|
| Job stuck in `running` for 10× expected duration | Backend stalled. Restart backend; jobs retry-resume from cursor. |
| Transcript says "Thanks for watching" out of nowhere | Whisper hallucination on silence (sharp-edges #2). VAD missing. |
| Two diarization runs label same speaker differently | Expected; diarization is per-job (sharp-edges #3). |
| OpenAI API 413 | Audio > 25MB. Split via VAD with overlap (sharp-edges #5). |
