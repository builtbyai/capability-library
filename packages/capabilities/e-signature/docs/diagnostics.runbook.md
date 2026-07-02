# e-signature · diagnostics runbook

## Rung 1 — open the standalone example

```bash
# Quickest smoke test: the original monolith works as a reference impl
start packages/capabilities/e-signature/examples/standalone.html   # Windows
xdg-open packages/capabilities/e-signature/examples/standalone.html # Linux
```

A full ceremony in the browser proves the algorithm is right. The componentized React version mirrors this behavior 1:1.

## Rung 2 — backend health (when wired)

```bash
curl http://127.0.0.1:5114/api/esig/sessions/<sessionId>
```

Compare to the in-memory state from the React app. Diffs = persistence broke.

## Rung 3 — hash verification

For an already-signed session:

```bash
curl -X POST http://127.0.0.1:5114/api/esig/verify -d '{"sessionId":"...","role":"A"}'
```

Expect `{ ok: true, expectedHash: "...", actualHash: "..." }` with both hashes matching. Mismatch → tampering OR the dataUrl was re-encoded on storage (sharp-edges #4).

## Symptom → cause

| Symptom | Cause |
|---|---|
| Drawn signature looks chunky/uniform | `velocityFactor` too low. Sharp-edges #1. |
| Stroke vanishes mid-draw | `velocityFactor` too high or `thicknessFloor` too low. |
| Exported PNG is 2× the canvas size | Using `canvasRef.current.toDataURL()` directly. Use `useSignatureCanvas.exportPng()`. Sharp-edges #2. |
| Typed preview shows wrong font | FOIT — Google Fonts not loaded yet. Sharp-edges #3. |
| Touch drawing scrolls the page on iOS | Wrap canvas in `overflow:hidden` parent. Sharp-edges #6. |
| Audit IP is wrong | Egress IP, not device. Expected. Sharp-edges #5. |
| Receipt missing both signatures on initial render | State hook hasn't received the SIGN action yet; the receipt step should only render once `session.status === 'completed'`. |
