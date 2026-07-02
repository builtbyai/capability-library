/**
 * e-signature contracts. ESIGN/UETA-compliant two-party signing.
 *
 * The flow:
 *   0. Session opens (esig.session.started)
 *   1. User picks a contract (esig.contract.selected)
 *   2. Terms reviewed + consent given (esig.terms.accepted)
 *   3. Party A signs (esig.party.signed{party:'A'})
 *   4. Party B signs (esig.party.signed{party:'B'})
 *   5. Receipt generated + delivered (esig.session.completed)
 *
 * Every signature carries: PNG dataUrl, SHA-256 hash of the bytes,
 * IP + userAgent at sign time, ISO timestamp.
 */
import { z } from 'zod';

// ============================================================================
// Static contract definition (the thing being signed)
// ============================================================================

export const ContractTermSchema = z.tuple([z.string(), z.string()]);
export type ContractTerm = z.infer<typeof ContractTermSchema>;

export const ContractDefinitionSchema = z.object({
  ref: z.string(),                                     // e.g. WTS-2026-0329-FB
  title: z.string(),
  type: z.string(),                                    // e.g. 'Fixed-Price Feature Build'
  value: z.string(),                                   // display value (e.g. '$4,250.00')
  terms: z.array(ContractTermSchema).min(1),           // key/value rows for the terms table
  scope: z.array(z.string()).min(1),                   // scope-of-work bullets
});
export type ContractDefinition = z.infer<typeof ContractDefinitionSchema>;

// ============================================================================
// Parties
// ============================================================================

export const PartySchema = z.object({
  role: z.enum(['A', 'B']),
  fullName: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});
export type Party = z.infer<typeof PartySchema>;

// ============================================================================
// Signature record (the persisted artifact per party)
// ============================================================================

export const SignatureModeSchema = z.enum(['type', 'draw']);
export type SignatureMode = z.infer<typeof SignatureModeSchema>;

export const SignaturePenColorSchema = z.enum(['#1A1A1A', '#1B3A6B', '#2B5C9E']);
export const SignatureThicknessSchema = z.union([z.literal(2), z.literal(3), z.literal(5)]);

export const SignatureRecordSchema = z.object({
  /** Party role this signature belongs to. */
  role: z.enum(['A', 'B']),
  mode: SignatureModeSchema,
  /** PNG data URL of the rendered signature (typed: font-rendered text; drawn: canvas export). */
  dataUrl: z.string().regex(/^data:image\/png;base64,/),
  /** sha256 of the PNG bytes (lowercase hex). Tampering detection. */
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  /** ISO timestamp of the confirm click. */
  timestamp: z.string().datetime(),
  /** IP captured at sign time. */
  ip: z.string(),
  /** Full UA at sign time. */
  userAgent: z.string(),
  /** Mode-specific metadata (font, pen color/thickness). */
  meta: z.union([
    z.object({ mode: z.literal('type'), fontName: z.string() }),
    z.object({ mode: z.literal('draw'), color: z.string(), thickness: z.number() }),
  ]),
});
export type SignatureRecord = z.infer<typeof SignatureRecordSchema>;

// ============================================================================
// Audit trail
// ============================================================================

export const AuditActionSchema = z.enum([
  'session-opened',
  'contract-selected',
  'terms-reviewed',
  'consent-given',
  'party-signed',
  'session-completed',
  'session-abandoned',
  'verify-checked',
  'pdf-downloaded',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEntrySchema = z.object({
  time: z.string().datetime(),
  action: AuditActionSchema,
  /** Human-readable explanation; appears verbatim in the receipt. */
  description: z.string(),
  /** Party that triggered the action, if applicable. */
  byRole: z.enum(['A', 'B']).optional(),
  ip: z.string(),
  userAgent: z.string(),
  /** Optional payload for the entry (e.g. signature hash for party-signed). */
  meta: z.record(z.unknown()).optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// ============================================================================
// Session (the in-flight signing ceremony)
// ============================================================================

export const SessionStatusSchema = z.enum([
  'created',
  'contract-selected',
  'terms-accepted',
  'party-a-signed',
  'completed',
  'abandoned',
  'verify-failed',
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SignatureSessionSchema = z.object({
  sessionId: z.string().uuid(),
  status: SessionStatusSchema,
  contract: ContractDefinitionSchema,
  parties: z.array(PartySchema).length(2),               // [Party A, Party B]
  signatures: z.object({
    A: SignatureRecordSchema.optional(),
    B: SignatureRecordSchema.optional(),
  }),
  audit: z.array(AuditEntrySchema),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type SignatureSession = z.infer<typeof SignatureSessionSchema>;

// ============================================================================
// Events
// ============================================================================

export const SessionStartedEvent  = z.object({ event: z.literal('esig.session.started'),  sessionId: z.string().uuid(), at: z.string() });
export const ContractSelectedEvent= z.object({ event: z.literal('esig.contract.selected'), sessionId: z.string().uuid(), contractRef: z.string(), at: z.string() });
export const TermsAcceptedEvent   = z.object({ event: z.literal('esig.terms.accepted'),   sessionId: z.string().uuid(), at: z.string() });
export const PartySignedEvent     = z.object({ event: z.literal('esig.party.signed'),     sessionId: z.string().uuid(), role: z.enum(['A','B']), hash: z.string(), at: z.string() });
export const SessionCompletedEvent= z.object({ event: z.literal('esig.session.completed'),sessionId: z.string().uuid(), contractRef: z.string(), at: z.string() });
export const SessionAbandonedEvent= z.object({ event: z.literal('esig.session.abandoned'),sessionId: z.string().uuid(), atStep: z.number().int(), at: z.string() });
export const VerifyFailedEvent    = z.object({ event: z.literal('esig.verify.failed'),    sessionId: z.string().uuid(), role: z.enum(['A','B']), expected: z.string(), actual: z.string(), at: z.string() });

export const EVENT_NAMES = {
  sessionStarted:    'esig.session.started',
  contractSelected:  'esig.contract.selected',
  termsAccepted:     'esig.terms.accepted',
  partySigned:       'esig.party.signed',
  sessionCompleted:  'esig.session.completed',
  sessionAbandoned:  'esig.session.abandoned',
  verifyFailed:      'esig.verify.failed',
} as const;

// ============================================================================
// Available fonts for typed signatures (must be loaded via Google Fonts)
// ============================================================================

export const SIGNATURE_FONTS = [
  { name: 'Dancing Script', family: "'Dancing Script', cursive" },
  { name: 'Great Vibes',    family: "'Great Vibes', cursive" },
  { name: 'Alex Brush',     family: "'Alex Brush', cursive" },
  { name: 'Pacifico',       family: "'Pacifico', cursive" },
  { name: 'Sacramento',     family: "'Sacramento', cursive" },
] as const;
export type SignatureFontName = (typeof SIGNATURE_FONTS)[number]['name'];

// ============================================================================
// Port (backend interface — frontend hooks talk to this)
// ============================================================================

export interface ESignaturePort {
  createSession(input: { contract: ContractDefinition; parties: [Party, Party] }): Promise<SignatureSession>;
  getSession(sessionId: string): Promise<SignatureSession>;
  recordSignature(sessionId: string, role: 'A' | 'B', signature: SignatureRecord): Promise<SignatureSession>;
  /** Independently re-hash the dataUrl bytes; reject if mismatch with stored hash. */
  verifySignature(sessionId: string, role: 'A' | 'B'): Promise<{ ok: boolean; expectedHash: string; actualHash: string }>;
  /** Render the final receipt as a PDF and stage it via intake-pipeline. */
  renderReceiptPdf(sessionId: string): Promise<{ intakeObjectId: string; bytes: number }>;
  appendAudit(sessionId: string, entry: Omit<AuditEntry, 'time'>): Promise<void>;
}
