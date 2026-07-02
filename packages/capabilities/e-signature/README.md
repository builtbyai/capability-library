# e-signature · _prototype_

ESIGN/UETA-compliant electronic signature portal. Two-party signing ceremony with type + draw modes, velocity-aware drawing, SHA-256 content hashing, IP + UA capture, full audit trail, branded print/PDF receipt.

**Originally:** a 1,771-line `advanced-sign.html` monolith.
**Now:** componentized React capability under `frontend/`, with backend stub, docs, and the original HTML preserved at `examples/standalone.html` for reference + smoke testing.

## Quick start

```tsx
import { ESignaturePortal } from '@multimarcdown/e-signature/frontend';
import '@multimarcdown/e-signature/frontend/styles/portal.css';

const CONTRACTS = [/* ContractDefinition[] */];
const PARTIES = [
  { role: 'A', fullName: 'Alex Morgan', company: 'Northwind Services LLC', email: 'provider@example.com', phone: '(555) 010-2000', address: '100 Market St, Springfield, IL 62701' },
  { role: 'B', fullName: 'Jordan Lee', company: 'Beacon Client Co.', email: 'client@example.com', phone: '(555) 010-3000' },
] as const;

<ESignaturePortal
  contracts={CONTRACTS}
  parties={PARTIES}
  onSignatureCaptured={async (sig) => {
    // POST to your backend for persistence + ESIG_HMAC_KEY verification
  }}
  onCompleted={(session) => console.log('executed:', session.sessionId)}
/>
```

## Structure

```
frontend/
  components/
    ESignaturePortal.tsx     Top-level orchestrator (uses state hook + composes the other pieces)
    Stepper.tsx              Numbered progress steps
    ContractSelector.tsx     Step 0 — pick from contracts[]
    TermsReview.tsx          Step 1 — terms + scope + consent checkbox
    SignaturePad.tsx         Steps 2/3 — typed OR drawn; consent + confirm
    TypedSignature.tsx       Typed mode + font picker; exports renderTypedToPng helper
    DrawnSignature.tsx       Drawn mode wrapping useSignatureCanvas
    SignatureReceipt.tsx     Step 4 — branded receipt + audit + legal disclaimer
    AuditTrailViewer.tsx     Audit-entry timeline
    Toast.tsx                Headless toasts + useToasts() hook
  hooks/
    useSignatureCanvas.ts    Velocity-aware drawing on a canvas
    useESignatureState.ts    Reducer-based ceremony state + sha256Hex helper
  styles/
    portal.css               All component styles, `esig-` prefixed
  index.ts                   Public exports
backend/
  index.ts                   Skeleton ESignaturePort impl (sqlite + intake pipeline integration)
contracts/
  events.ts                  zod schemas + types + ESignaturePort interface
docs/
  architecture.md
  sharp-edges.md
  diagnostics.runbook.md
examples/
  standalone.html            Original 1,771-line monolith preserved for reference
```

## Legal compliance

The receipt + audit trail satisfy the technical requirements for:
- **ESIGN Act** (15 U.S.C. § 7001) — consent recorded with timestamp + IP
- **Texas UETA** (Tex. Bus. & Com. Code Ch. 322) — same

Cryptographic guarantees:
- Each signature carries a SHA-256 hash of its PNG bytes (`SignatureRecord.hash`)
- The backend's `verifySignature(sessionId, role)` re-hashes and compares; mismatch emits `esig.verify.failed`
- Audit entries are append-only on persistence (no `UPDATE` from the API surface)

## Sharp edges

See `docs/sharp-edges.md`. The drawing path has a velocity-thickness formula that needs `velocityFactor=0.15` and `thicknessFloor=0.4` for the strokes to look like pen ink and not magic-marker.
