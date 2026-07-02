# transcription · architecture

```
intake.object.routed{mime: audio/* | video/*} -> transcription:run job
                                                        |
                                                        v
                                          ffmpeg decode to 16kHz mono WAV
                                                        |
                                                        v
                                          backend (whisper-cpp | openai | deepgram | ollama)
                                                        |
                                                        v
                                          segments[] (start_ms, end_ms, text, speaker?)
                                                        |
                                                        v
                                          group segments into ChunkBase chunks (token-aware, respects speaker boundaries)
                                                        |
                                                        v
                                          emit transcription.segment.created per segment
                                          emit knowledge.chunk.created per chunk
                                          emit transcription.completed
```

Diarization (speaker labels) is a separate `transcription:diarize` job run after the base transcription completes. It can use the same backend or a different one (deepgram's diarization is best; whisper-cpp's is meh).
