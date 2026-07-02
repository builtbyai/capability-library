/**
 * e-signature backend stub.
 *
 * Persists sessions + audit trail to sqlite (better-sqlite3); stages the final
 * signed PDF via intake-pipeline. SHA-256 verification re-hashes the stored
 * dataUrl and compares to the recorded hash — tampering shows up immediately.
 *
 * This file ships as a skeleton. The functions throw 'NotImplemented' for
 * persistence ops until the storage layer lands.
 */
import { z } from 'zod';
import {
  ContractDefinitionSchema,
  PartySchema,
  SignatureRecordSchema,
  type ContractDefinition,
  type Party,
  type SignatureRecord,
  type SignatureSession,
  type AuditEntry,
  type ESignaturePort,
} from '../contracts/events.js';

const CreateSessionInputSchema = z.object({
  contract: ContractDefinitionSchema,
  parties: z.tuple([PartySchema, PartySchema]),
});

const NOT_IMPL = (op: string): never => {
  throw new Error(`e-signature backend: ${op} not implemented (storage layer pending)`);
};

export const eSignatureBackend: ESignaturePort = {
  async createSession(input) {
    CreateSessionInputSchema.parse(input);
    return NOT_IMPL('createSession');
  },
  async getSession(_sessionId: string): Promise<SignatureSession> {
    return NOT_IMPL('getSession');
  },
  async recordSignature(_sessionId: string, role: 'A' | 'B', signature: SignatureRecord): Promise<SignatureSession> {
    SignatureRecordSchema.parse(signature);
    if (signature.role !== role) throw new Error('signature.role mismatch with route param');
    return NOT_IMPL('recordSignature');
  },
  async verifySignature(_sessionId, _role) {
    return NOT_IMPL('verifySignature');
  },
  async renderReceiptPdf(_sessionId) {
    return NOT_IMPL('renderReceiptPdf');
  },
  async appendAudit(_sessionId, _entry: Omit<AuditEntry, 'time'>) {
    return NOT_IMPL('appendAudit');
  },
};

export { type ContractDefinition, type Party, type SignatureRecord, type SignatureSession };
