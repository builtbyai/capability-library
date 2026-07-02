# e-signature · architecture

## State machine

```
created → contract-selected → terms-accepted → party-a-signed → completed
                                                       ↘
                                                    abandoned (from any step)
```

Lives in `useESignatureState`. Five steps, but the state machine is independent of step number — `step` is for the UI, `status` is the legal/auditable state.

## Components

| Layer | Component | Owns |
|---|---|---|
| Orchestrator | `ESignaturePortal` | Step routing, toast state, dispatching to state hook |
| Step 0 | `ContractSelector` | Card grid, hover/keyboard nav, `onSelect` |
| Step 1 | `TermsReview` | Terms table, scope list, party boxes, consent checkbox |
| Step 2/3 | `SignaturePad` | Type/draw tab switching, consent, confirm |
| - typed | `TypedSignature` | Text input + font picker + preview |
| - drawn | `DrawnSignature` | Canvas + color/thickness/undo/clear |
| Step 4 | `SignatureReceipt` | Branded header, sig display grid, audit trail, legal disclaimer |
| Cross-cut | `Stepper`, `ToastContainer`, `AuditTrailViewer` | Reusable atoms |

## Drawing path

`useSignatureCanvas` implements velocity-thickness ink rendering. Each segment between two points scales thickness by `(1 - speed × velocityFactor)`, floored at `thickness × thicknessFloor`. Defaults `0.15` and `0.4` were tuned in the original HTML; changing them changes the "ink" feel.

DPI scaling: canvas is multiplied by `devicePixelRatio` so 1px-width stroke renders crisp on Retina. Export normalizes back to 1x for consistent PNG dimensions across machines.

## Crypto path

1. Frontend renders typed → PNG via `renderTypedToPng()` OR drawn → PNG via `useSignatureCanvas.exportPng()`
2. Frontend computes `sha256Hex(dataUrl)` and packages into a `SignatureRecord`
3. Backend (when wired) re-computes the hash on receipt and stores both for tamper detection
4. The receipt displays the hash; verification is `POST /api/esig/verify` which re-hashes from storage

## Backend persistence (skeleton)

`backend/index.ts` defines the `ESignaturePort` shape but throws `NotImplemented`. The intended impl:
- sqlite (`better-sqlite3`) keyed by `sessionId`
- Three tables: `sessions`, `signatures`, `audit_entries`
- Append-only audit (no `UPDATE`); enforce at app layer
- Final PDF rendered via headless-Chromium / Playwright, then handed to `intake-pipeline.ingestUpload({source:'esig'})`

## Integration with other capabilities

| Other cap | How it fits |
|---|---|
| `intake-pipeline` | Signed PDFs land here for archive; gets a canonical `IntakeObject` |
| `notify` | Outbound delivery of executed agreement (email both parties, optional WhatsApp via `whatsapp-bridge`) |
| `session-digest` | Optionally generate a caveman-format LLM-handoff digest of the ceremony for later reference |
| `connector-config` | Stores the ESIG_HMAC_KEY and counter-party email connector |
