# transcription · sharp edges

## 1. ffmpeg sample-rate conversion lossy at the boundary

All whisper-family models want 16kHz mono. Source audio is rarely that. Naive `ffmpeg -ar 16000` resampling drops high-frequency cues that whisper uses for word boundaries; use `-af aresample=resampler=soxr -ar 16000 -ac 1`. The softer SoX resampler is ~2% better on WER for podcast audio.

## 2. Whisper hallucinates on silence

Long silences (>3s) cause whisper to invent text ("Thanks for watching!" is famously common). Use VAD (Voice Activity Detection) to chunk audio BEFORE feeding whisper, or filter segments with `confidence < 0.3` AND high entropy. Don't trust the raw output for monetizable downstream pipelines.

## 3. Speaker diarization is unstable across backends

`Speaker_0` from whisper-cpp ≠ `Speaker_0` from deepgram across two runs of the same audio. Diarization is per-job, not global. The `relabelSpeaker` endpoint exists because users will absolutely need to rename `Speaker_0` → "Jalen" after the fact.

## 4. Long-form audio + chunk boundaries cross speakers

A token-aware chunk can span a speaker turn change. Knowledge-index will embed text that says "...so I think... well, no, you should..." with no speaker indication. The chunk's `speakers: string[]` field exists so retrieval surfaces show "this chunk contains Speaker_0 and Speaker_1" instead of attributing the whole chunk to one person.

## 5. OpenAI Whisper API caps audio at 25MB per request

Long recordings need to be split. Naive split-at-fixed-duration cuts words. Use VAD-based splitting at silence boundaries, and overlap chunks by ~2s so word-boundary recovery is possible.
