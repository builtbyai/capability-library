import { useCallback, useEffect, useReducer } from 'react';
import type {
  ContractDefinition,
  Party,
  SignatureRecord,
  SignatureSession,
  SessionStatus,
  AuditEntry,
  AuditAction,
} from '../../contracts/events.js';

/**
 * The signing-ceremony state machine. Pure-frontend variant — operates on
 * in-memory state. The backend ESignaturePort.recordSignature() should be
 * called by the consumer at confirm time to persist.
 *
 * Transitions:
 *   created → contract-selected → terms-accepted → party-a-signed → completed
 *                                                         ↓
 *                                                     abandoned (from any step)
 */

interface State {
  session: SignatureSession;
  step: 0 | 1 | 2 | 3 | 4;
  clientIp: string;
}

type Action =
  | { type: 'SELECT_CONTRACT'; contract: ContractDefinition }
  | { type: 'ACCEPT_TERMS' }
  | { type: 'GO_TO_STEP'; step: 0 | 1 | 2 | 3 | 4 }
  | { type: 'SIGN'; role: 'A' | 'B'; signature: SignatureRecord }
  | { type: 'ABANDON' }
  | { type: 'SET_IP'; ip: string }
  | { type: 'APPEND_AUDIT'; entry: Omit<AuditEntry, 'time'> };

function nowIso(): string {
  return new Date().toISOString();
}

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'SELECT_CONTRACT': {
      const audit: AuditEntry = {
        time: nowIso(),
        action: 'contract-selected',
        description: `Selected contract ${action.contract.ref}: ${action.contract.title}`,
        ip: state.clientIp,
        userAgent: navigator.userAgent,
        meta: { contractRef: action.contract.ref },
      };
      return {
        ...state,
        session: {
          ...state.session,
          status: 'contract-selected',
          contract: action.contract,
          audit: [...state.session.audit, audit],
        },
      };
    }

    case 'ACCEPT_TERMS': {
      const audit: AuditEntry = {
        time: nowIso(),
        action: 'consent-given',
        description: 'User consented to electronic signing under ESIGN Act + Texas UETA',
        ip: state.clientIp,
        userAgent: navigator.userAgent,
      };
      return {
        ...state,
        session: {
          ...state.session,
          status: 'terms-accepted',
          audit: [...state.session.audit, audit],
        },
      };
    }

    case 'GO_TO_STEP':
      return { ...state, step: action.step };

    case 'SIGN': {
      const partyName = state.session.parties.find((p) => p.role === action.role)?.fullName ?? `Party ${action.role}`;
      const signatures = { ...state.session.signatures, [action.role]: action.signature };
      const nextStatus: SessionStatus = action.role === 'A' ? 'party-a-signed' : 'completed';
      const auditPartySigned: AuditEntry = {
        time: nowIso(),
        action: 'party-signed',
        description: `${partyName} (Party ${action.role}) signed the agreement`,
        byRole: action.role,
        ip: state.clientIp,
        userAgent: navigator.userAgent,
        meta: { hash: action.signature.hash, mode: action.signature.mode },
      };
      const completedAudit: AuditEntry | null =
        action.role === 'B'
          ? {
              time: nowIso(),
              action: 'session-completed',
              description: 'Agreement fully executed — both parties signed',
              ip: state.clientIp,
              userAgent: navigator.userAgent,
            }
          : null;
      return {
        ...state,
        session: {
          ...state.session,
          status: nextStatus,
          signatures,
          audit: completedAudit
            ? [...state.session.audit, auditPartySigned, completedAudit]
            : [...state.session.audit, auditPartySigned],
          completedAt: action.role === 'B' ? nowIso() : state.session.completedAt,
        },
        step: action.role === 'A' ? 3 : 4,
      };
    }

    case 'ABANDON': {
      const audit: AuditEntry = {
        time: nowIso(),
        action: 'session-abandoned',
        description: `Session abandoned at step ${state.step}`,
        ip: state.clientIp,
        userAgent: navigator.userAgent,
      };
      return {
        ...state,
        session: {
          ...state.session,
          status: 'abandoned',
          audit: [...state.session.audit, audit],
        },
      };
    }

    case 'SET_IP':
      return { ...state, clientIp: action.ip };

    case 'APPEND_AUDIT':
      return {
        ...state,
        session: {
          ...state.session,
          audit: [...state.session.audit, { ...action.entry, time: nowIso() }],
        },
      };

    default:
      return state;
  }
}

export interface UseESignatureStateOptions {
  initialContract: ContractDefinition;
  parties: [Party, Party];
  ipLookupUrl?: string;
}

export function useESignatureState(opts: UseESignatureStateOptions) {
  const { initialContract, parties, ipLookupUrl = 'https://api.ipify.org?format=json' } = opts;

  const initial: State = {
    session: {
      sessionId: crypto.randomUUID(),
      status: 'created',
      contract: initialContract,
      parties,
      signatures: {},
      audit: [
        {
          time: nowIso(),
          action: 'session-opened',
          description: 'Document opened and terms reviewed',
          ip: 'Fetching...',
          userAgent: navigator.userAgent,
        },
      ],
      createdAt: nowIso(),
    },
    step: 0,
    clientIp: 'Fetching...',
  };

  const [state, dispatch] = useReducer(reduce, initial);

  // Fetch IP once.
  useEffect(() => {
    let cancelled = false;
    fetch(ipLookupUrl)
      .then((r) => r.json())
      .then((d: { ip?: string }) => {
        if (!cancelled && d.ip) dispatch({ type: 'SET_IP', ip: d.ip });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'SET_IP', ip: 'Unavailable' });
      });
    return () => { cancelled = true; };
  }, [ipLookupUrl]);

  const selectContract = useCallback((c: ContractDefinition) => dispatch({ type: 'SELECT_CONTRACT', contract: c }), []);
  const acceptTerms    = useCallback(() => dispatch({ type: 'ACCEPT_TERMS' }), []);
  const goToStep       = useCallback((step: 0 | 1 | 2 | 3 | 4) => dispatch({ type: 'GO_TO_STEP', step }), []);
  const sign           = useCallback((role: 'A' | 'B', signature: SignatureRecord) => dispatch({ type: 'SIGN', role, signature }), []);
  const abandon        = useCallback(() => dispatch({ type: 'ABANDON' }), []);
  const appendAudit    = useCallback((entry: Omit<AuditEntry, 'time'>) => dispatch({ type: 'APPEND_AUDIT', entry }), []);

  return {
    session: state.session,
    step: state.step,
    clientIp: state.clientIp,
    selectContract,
    acceptTerms,
    goToStep,
    sign,
    abandon,
    appendAudit,
  };
}

/** SHA-256 hex digest of a string. Used for signature integrity. */
export async function sha256Hex(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
