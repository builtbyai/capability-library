/**
 * terminalStore — the heart of terminal persistence.
 *
 * A terminal must survive three different teardowns, and this module is what
 * makes that true:
 *
 *   1. React unmount (tab switch): the xterm DOM node is moved into a hidden
 *      "parking" element instead of being destroyed, then moved back on remount.
 *   2. Browser refresh: the PTY sessionId is persisted to localStorage so we can
 *      re-attach to the still-running process instead of spawning a new one.
 *   3. WebSocket hiccup: we reconnect and re-attach, keeping the same session.
 *
 * The store owns one TerminalEntry per slot in a module-level Map (singleton
 * across the whole app), so React components are thin views over it.
 */
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { parseFrame, type HostToClient } from '../contracts/protocol.js';
import type { TerminalConfig, LaunchProfile } from '../contracts/config.js';
import {
  buildLaunchKeystrokes,
  isAgentProfile,
  isExitCommand,
  waitForReplPrompt,
} from './launchProfiles.js';
import { registerSession, unregisterSession } from './shellContext.js';

export type TerminalStatus = 'idle' | 'connecting' | 'ready' | 'error' | 'closed';
export type TerminalMode = 'direct' | 'cloud';

export interface TerminalEntry {
  slot: string;
  xterm: Terminal;
  fit: FitAddon;
  wrapper: HTMLDivElement;
  ws?: WebSocket;
  sessionId?: string;
  status: TerminalStatus;
  statusDetail?: string;
  claudeAlive: boolean;
  activeProfileId?: string;
  mode: TerminalMode;
  opened: boolean; // has xterm.open() been called yet?
  /** Prompts waiting for an agent REPL to be ready. */
  handoffQueue: string[];
  listeners: Set<() => void>;
}

const entries = new Map<string, TerminalEntry>();
let config: TerminalConfig | null = null;

/** Call once at app start with your validated TerminalConfig. */
export function configureStore(cfg: TerminalConfig): void {
  config = cfg;
}

function cfg(): TerminalConfig {
  if (!config) throw new Error('terminalStore not configured — call configureStore(config) first');
  return config;
}

// --- parking element --------------------------------------------------------
let parkingEl: HTMLDivElement | null = null;
function parking(): HTMLDivElement {
  if (!parkingEl) {
    parkingEl = document.createElement('div');
    parkingEl.id = '__pty-parking';
    parkingEl.style.position = 'absolute';
    parkingEl.style.left = '-99999px';
    parkingEl.style.top = '0';
    parkingEl.style.width = '800px';
    parkingEl.style.height = '480px';
    document.body.appendChild(parkingEl);
  }
  return parkingEl;
}

// --- entry lifecycle --------------------------------------------------------
export function getOrCreateEntry(slot: string): TerminalEntry {
  const existing = entries.get(slot);
  if (existing) return existing;

  const xterm = new Terminal({
    cursorBlink: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    theme: { background: 'rgba(0,0,0,0)' },
    allowProposedApi: true,
    scrollback: 5000,
  });
  const fit = new FitAddon();
  xterm.loadAddon(fit);
  xterm.loadAddon(new WebLinksAddon());

  const wrapper = document.createElement('div');
  wrapper.className = 'pty-xterm-wrapper';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  parking().appendChild(wrapper);

  const entry: TerminalEntry = {
    slot,
    xterm,
    fit,
    wrapper,
    status: 'idle',
    claudeAlive: false,
    mode: 'direct',
    opened: false,
    handoffQueue: [],
    listeners: new Set(),
  };
  entries.set(slot, entry);

  // Register with shellContext so an AI popup can read this session's scrollback.
  registerSession({ slot, readScrollback: () => readScrollback(xterm) });

  // Forward user keystrokes to the PTY, and track exit commands.
  xterm.onData((d) => {
    if (isExitCommand(d.replace(/\r$/, ''))) entry.claudeAlive = false;
    sendInput(entry, d);
  });

  return entry;
}

/** Mount a slot's terminal into a visible container (call from a React effect). */
export function mountEntry(slot: string, container: HTMLElement): void {
  const entry = getOrCreateEntry(slot);
  container.appendChild(entry.wrapper);
  if (!entry.opened) {
    entry.xterm.open(entry.wrapper);
    entry.opened = true;
  }
  // Defer fit to next frame so the container has its real size.
  requestAnimationFrame(() => {
    try {
      entry.fit.fit();
      sendResize(entry);
    } catch {
      /* container not laid out yet */
    }
  });
}

/** Detach from the DOM without destroying — survival across React unmount. */
export function unmountEntry(slot: string): void {
  const entry = entries.get(slot);
  if (!entry) return;
  parking().appendChild(entry.wrapper); // move back to parking; keep xterm alive
}

/** Fully dispose a slot (explicit user "close terminal"). */
export function disposeEntry(slot: string): void {
  const entry = entries.get(slot);
  if (!entry) return;
  try {
    if (entry.ws && entry.sessionId) {
      entry.ws.send(JSON.stringify({ t: 'kill', sessionId: entry.sessionId }));
    }
  } catch {
    /* ignore */
  }
  entry.ws?.close();
  entry.xterm.dispose();
  entry.wrapper.remove();
  unregisterSession(slot);
  localStorage.removeItem(cfg().storageKeys.sessionPrefix + slot);
  entries.delete(slot);
}

// --- connection -------------------------------------------------------------
export async function connect(slot: string, mode: TerminalMode): Promise<void> {
  const entry = getOrCreateEntry(slot);
  entry.mode = mode;
  setStatus(entry, 'connecting');
  try {
    if (mode === 'direct') await connectDirect(entry);
    else await connectCloud(entry);
  } catch (err) {
    setStatus(entry, 'error', err instanceof Error ? err.message : String(err));
  }
}

async function connectDirect(entry: TerminalEntry): Promise<void> {
  const c = cfg();
  const backend = localStorage.getItem(c.storageKeys.backendHost) || c.backendUrl;
  const storedSession = localStorage.getItem(c.storageKeys.sessionPrefix + entry.slot);

  // Try to re-attach to an existing PTY; else create a new one.
  let sessionId = storedSession ?? undefined;
  if (sessionId) {
    const ok = await post(backend + '/api/pty/attach', { sessionId }).then((r) => r?.ok).catch(() => false);
    if (!ok) sessionId = undefined;
  }
  if (!sessionId) {
    const info = await post(backend + '/api/pty/create', {
      cols: entry.xterm.cols,
      rows: entry.xterm.rows,
    });
    sessionId = info?.sessionId as string;
    if (!sessionId) throw new Error('backend did not return a sessionId');
  }
  entry.sessionId = sessionId;
  localStorage.setItem(c.storageKeys.sessionPrefix + entry.slot, sessionId);

  const wsUrl = backend.replace(/^http/, 'ws') + '/ws/terminal/' + sessionId;
  openSocket(entry, wsUrl);
}

async function connectCloud(entry: TerminalEntry): Promise<void> {
  const c = cfg();
  const token = localStorage.getItem(c.storageKeys.apiToken) ?? '';
  const storedSession = localStorage.getItem(c.storageKeys.sessionPrefix + entry.slot);
  const sessionId = storedSession ?? crypto.randomUUID();
  entry.sessionId = sessionId;

  const url =
    c.cloudWsBase.replace(/\/$/, '') +
    `/v1/pty/client?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;

  openSocket(entry, url, () => {
    // On open: attach if we had a session, else spawn a fresh one.
    if (storedSession) {
      send(entry, { t: 'attach', sessionId, cols: entry.xterm.cols, rows: entry.xterm.rows });
    } else {
      send(entry, { t: 'spawn', sessionId, cols: entry.xterm.cols, rows: entry.xterm.rows });
      localStorage.setItem(c.storageKeys.sessionPrefix + entry.slot, sessionId);
    }
  });
}

function openSocket(entry: TerminalEntry, url: string, onOpen?: () => void): void {
  const ws = new WebSocket(url);
  entry.ws = ws;

  ws.onopen = () => {
    setStatus(entry, 'ready');
    onOpen?.();
  };
  ws.onmessage = (ev) => {
    const frame = parseFrame(typeof ev.data === 'string' ? ev.data : '');
    if (frame) handleHostFrame(entry, frame as HostToClient);
    else if (typeof ev.data === 'string') entry.xterm.write(ev.data); // tolerate raw data
  };
  ws.onclose = () => {
    if (entry.status !== 'closed') setStatus(entry, 'error', 'connection closed');
  };
  ws.onerror = () => setStatus(entry, 'error', 'websocket error');
}

function handleHostFrame(entry: TerminalEntry, frame: HostToClient): void {
  switch (frame.t) {
    case 'data':
      entry.xterm.write(frame.d);
      return;
    case 'spawned':
      if (frame.ok) {
        setStatus(entry, 'ready');
        if (frame.cols && frame.rows) entry.xterm.resize(frame.cols, frame.rows);
      } else {
        const diag = frame.diag ? `\r\n\x1b[90m[diag] ${JSON.stringify(frame.diag)}\x1b[0m` : '';
        entry.xterm.write(`\r\n\x1b[31m${frame.error ?? 'spawn failed'}\x1b[0m${diag}\r\n`);
        setStatus(entry, 'error', frame.error);
      }
      return;
    case 'attached':
      if (frame.ok) {
        setStatus(entry, 'ready');
      } else {
        // Re-attach failed (process gone) — spawn fresh, keep the slot.
        if (entry.sessionId) send(entry, { t: 'spawn', sessionId: entry.sessionId, cols: entry.xterm.cols, rows: entry.xterm.rows });
      }
      return;
    case 'exit':
      entry.claudeAlive = false;
      entry.xterm.write(`\r\n\x1b[90m[process exited: ${frame.code}]\x1b[0m\r\n`);
      setStatus(entry, 'closed');
      localStorage.removeItem(cfg().storageKeys.sessionPrefix + entry.slot);
      return;
    case 'bridge-down':
      entry.claudeAlive = false;
      entry.xterm.write(
        `\r\n\x1b[33m[bridge down on ${frame.host}: ${frame.reason}] — start the bridge daemon on the host machine\x1b[0m\r\n`,
      );
      setStatus(entry, 'error', 'bridge down');
      return;
    case 'error':
      entry.xterm.write(`\r\n\x1b[31m${frame.message}\x1b[0m\r\n`);
      return;
  }
}

// --- input / sizing ---------------------------------------------------------
function sendInput(entry: TerminalEntry, d: string): void {
  if (!entry.ws || entry.ws.readyState !== WebSocket.OPEN) return;
  if (entry.mode === 'cloud') send(entry, { t: 'data', sessionId: entry.sessionId, d });
  else entry.ws.send(JSON.stringify({ t: 'data', d }));
}

export function sendResize(entry: TerminalEntry): void {
  if (!entry.ws || entry.ws.readyState !== WebSocket.OPEN) return;
  const { cols, rows } = entry.xterm;
  if (entry.mode === 'cloud') send(entry, { t: 'resize', sessionId: entry.sessionId, cols, rows });
  else entry.ws.send(JSON.stringify({ t: 'resize', cols, rows }));
}

export function fit(slot: string): void {
  const entry = entries.get(slot);
  if (!entry) return;
  try {
    entry.fit.fit();
    sendResize(entry);
  } catch {
    /* not laid out */
  }
}

function send(entry: TerminalEntry, frame: Record<string, unknown>): void {
  entry.ws?.send(JSON.stringify(frame));
}

// --- launch profiles + handoff ----------------------------------------------
/** Launch a profile in this slot (cd into cwd, run the command, track agent state). */
export async function launchProfile(slot: string, profile: LaunchProfile, cwd?: string): Promise<void> {
  const entry = getOrCreateEntry(slot);
  entry.activeProfileId = profile.id;
  const keystrokes = buildLaunchKeystrokes(profile, cwd);
  sendInput(entry, keystrokes);

  if (isAgentProfile(profile)) {
    const ready = await waitForReplPrompt(entry.xterm, 30_000);
    entry.claudeAlive = ready;
    notify(entry);
    if (ready) drainHandoff(slot);
  }
}

/** Queue (or immediately send) a prompt to the agent in this slot. */
export function handoffToAgent(slot: string, prompt: string): void {
  const entry = getOrCreateEntry(slot);
  if (entry.claudeAlive) {
    sendInput(entry, prompt + '\r');
  } else {
    entry.handoffQueue.push(prompt);
  }
}

function drainHandoff(slot: string): void {
  const entry = entries.get(slot);
  if (!entry || !entry.claudeAlive) return;
  const queued = entry.handoffQueue.splice(0);
  for (const prompt of queued) sendInput(entry, prompt + '\r');
}

// --- subscription / status --------------------------------------------------
export function subscribeEntry(slot: string, listener: () => void): () => void {
  const entry = getOrCreateEntry(slot);
  entry.listeners.add(listener);
  return () => entry.listeners.delete(listener);
}

function setStatus(entry: TerminalEntry, status: TerminalStatus, detail?: string): void {
  entry.status = status;
  entry.statusDetail = detail;
  notify(entry);
}
function notify(entry: TerminalEntry): void {
  for (const l of entry.listeners) l();
}

// --- helpers ----------------------------------------------------------------
function readScrollback(term: Terminal): string {
  const buf = term.buffer.active;
  const lines: string[] = [];
  const end = buf.baseY + buf.cursorY;
  for (let y = Math.max(0, end - 200); y <= end; y++) {
    lines.push(buf.getLine(y)?.translateToString(true) ?? '');
  }
  return lines.join('\n');
}

async function post(url: string, body: unknown): Promise<any> {
  const c = cfg();
  const token = localStorage.getItem(c.storageKeys.apiToken) ?? '';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { 'X-Dashboard-Token': token } : {}) },
    body: JSON.stringify(body),
  });
  return r.ok ? r.json() : null;
}

export function getEntry(slot: string): TerminalEntry | undefined {
  return entries.get(slot);
}
