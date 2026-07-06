/**
 * shellContext — the bridge between an AI popup and the live PTY.
 *
 * Three things the AI can do through this registry:
 *   1. read cleaned (ANSI-stripped) scrollback from the active session;
 *   2. propose a command (a chip appears above the terminal; Tab/Run accepts);
 *   3. hand off a prompt to Claude inside the PTY via a window CustomEvent.
 *
 * If you don't want AI proposals, every export here can be stubbed as a no-op
 * (the component imports against this interface, not a concrete dependency).
 */

export interface CommandProposal {
  id: string;
  command: string;
  rationale: string;
  createdAt: number;
}

interface SessionRegistration {
  slot: string;
  /** Returns up to ~6KB of cleaned scrollback for this session. */
  readScrollback: () => string;
}

type Listener = () => void;

const sessions = new Map<string, SessionRegistration>();
let activeSlot: string | null = null;
const proposals = new Map<string, CommandProposal[]>(); // slot -> queue
const listeners = new Set<Listener>();

const MAX_SCROLLBACK_BYTES = 6 * 1024;
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

export function registerSession(reg: SessionRegistration): void {
  sessions.set(reg.slot, reg);
  if (!activeSlot) activeSlot = reg.slot;
  notify();
}

export function unregisterSession(slot: string): void {
  sessions.delete(slot);
  proposals.delete(slot);
  if (activeSlot === slot) activeSlot = sessions.keys().next().value ?? null;
  notify();
}

export function setActiveSession(slot: string): void {
  if (sessions.has(slot)) {
    activeSlot = slot;
    notify();
  }
}

export function getActiveSlot(): string | null {
  return activeSlot;
}

/** Cleaned, length-capped scrollback for the active session (for the AI to read). */
export function getActiveScrollback(): string {
  if (!activeSlot) return '';
  const reg = sessions.get(activeSlot);
  if (!reg) return '';
  const cleaned = reg.readScrollback().replace(ANSI, '');
  return cleaned.length > MAX_SCROLLBACK_BYTES ? cleaned.slice(-MAX_SCROLLBACK_BYTES) : cleaned;
}

/** Queue a command proposal for the active session. */
export function queueProposal(input: { command: string; rationale: string }): CommandProposal {
  const slot = activeSlot ?? '__none__';
  const proposal: CommandProposal = {
    id: crypto.randomUUID(),
    command: input.command,
    rationale: input.rationale,
    createdAt: Date.now(),
  };
  const queue = proposals.get(slot) ?? [];
  queue.push(proposal);
  proposals.set(slot, queue);
  notify();
  return proposal;
}

export function getProposalsFor(slot: string): CommandProposal[] {
  return proposals.get(slot) ?? [];
}

export function dismissProposal(slot: string, id: string): void {
  const queue = proposals.get(slot);
  if (!queue) return;
  proposals.set(slot, queue.filter((p) => p.id !== id));
  notify();
}

/** Called by the component when a proposal is accepted (after it's been typed). */
export function runProposal(slot: string, id: string): CommandProposal | undefined {
  const queue = proposals.get(slot);
  const proposal = queue?.find((p) => p.id === id);
  if (proposal) dismissProposal(slot, id);
  return proposal;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const l of listeners) l();
}

// --- handoff -----------------------------------------------------------------
export const HANDOFF_EVENT = 'pty:send-to-claude';

export interface HandoffDetail {
  prompt: string;
}

/** Fire from an AI popup to hand a prompt to the terminal. */
export function dispatchHandoff(prompt: string): void {
  window.dispatchEvent(new CustomEvent<HandoffDetail>(HANDOFF_EVENT, { detail: { prompt } }));
}
