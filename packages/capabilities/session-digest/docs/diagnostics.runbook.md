# session-digest · diagnostics runbook

## Rung 1 — templates loaded

```bash
curl http://127.0.0.1:5112/api/digest/_templates
```

At least one template per variant (desktop, mobile, caveman). Missing variant = render will throw at request time.

## Rung 2 — fixture roundtrip

```bash
curl -X POST http://127.0.0.1:5112/api/digest/generate \
  -d '{"source":{"kind":"manual","markdown":"# Test\n\nbody"},"variants":["desktop","mobile","caveman"]}'
```

Expect 200 + `{ digestId, artifacts: {desktop, mobile, caveman} }`. Fetch each artifact and confirm non-empty.

## Rung 3 — channel test

`POST /api/digest/:digestId/send` with `channel:'email'`. Open Gmail to verify the mobile variant renders without broken CSS.

## Symptom → cause

| Symptom | Cause |
|---|---|
| Email looks broken on iPhone | Inlined CSS dropped a fallback (sharp-edges #1). Test in Litmus. |
| Transcript ingest fails | JSONL schema changed (sharp-edges #2). Update extractor fallback. |
| Caveman digest too short | Over-compression (sharp-edges #3). Inspect dropped sections. |
| WhatsApp send shows raw HTML | Missing channel-formatter (sharp-edges #4). |
| ImpactIQ digest rejected at render | Template brand mismatch (sharp-edges #5). |
