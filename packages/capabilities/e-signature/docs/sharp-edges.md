# e-signature · sharp edges

## 1. Velocity formula tuning is load-bearing

`useSignatureCanvas` uses `thickness × (1 - speed × velocityFactor)` floored at `thickness × thicknessFloor`. The defaults (`0.15` / `0.4`) were tuned in the original HTML to match Wacom-pen feel. Bumping `velocityFactor` higher than 0.2 makes fast strokes vanish; lowering below 0.05 makes everything magic-marker-uniform. Do not change without re-validating with a real handwriting sample.

## 2. devicePixelRatio + export must round-trip cleanly

If you draw at DPR=2 (Retina) then export without re-scaling, the PNG is 2× the displayed size and `verifySignature` will hash a different number of bytes than what visually was drawn. `useSignatureCanvas.exportPng()` always exports at 1x (CSS-pixel dimensions). Do NOT export from `canvasRef.current.toDataURL()` directly — that gets the DPR-scaled buffer.

## 3. Google Fonts FOIT delays font picking

Typed signatures depend on Google Fonts (Dancing Script, Great Vibes, Alex Brush, Pacifico, Sacramento). If the page renders before the fonts load, the preview shows a fallback (system cursive). Either preload via `<link rel="preload" as="font">` OR wait for `document.fonts.ready` before enabling the type tab.

## 4. SHA-256 of dataUrl ≠ SHA-256 of PNG bytes

Currently the hash is computed over the entire `data:image/png;base64,...` string, NOT the decoded PNG bytes. That's a deliberate choice (the dataUrl IS what we ship), but a future verifier that fetches the PNG from R2 and hashes the bytes will produce a different value. Document this; either keep the dataUrl-hash convention everywhere OR migrate to byte-hash before any external party relies on a hash.

## 5. IP from api.ipify.org is the egress IP, not the signing device

A user behind a corporate NAT signs from their laptop, but the audit captures the office gateway's public IP. That's still ESIGN-compliant ("at least one form of attribution") but don't claim it identifies the device. The user-agent string is the device fingerprint; the IP is the network.

## 6. Touch events on iOS require `touch-action: none` AND `passive: false`

Both are set, but iOS Safari has historically ignored `touch-action: none` when the canvas is inside a scrollable container. Symptom: drawing scrolls the page instead of producing strokes. Wrap the canvas in a container with `overflow: hidden` and consider `prevent-default` on the wrapper too.

## 7. window.print() is the PDF path — there is no server-side PDF yet

The "Download PDF" button calls `window.print()`. Real PDF rendering (Chromium-headless or Playwright) is in the backend skeleton but not implemented. Setting `onDownload` lets callers wire their own; default reuses the print dialog.

## 8. Typed signatures aren't legally distinct from a typed name

The legal weight comes from CONSENT + AUDIT, not from cursive aesthetics. A "drawn" signature is no more binding than a typed one under ESIGN. The drawing UI exists for user comfort; do not market it as additional legal weight.
