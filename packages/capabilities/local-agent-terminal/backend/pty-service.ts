/**
 * pty-service — owns node-pty processes and fans their output out to any number
 * of attached listener sockets.
 *
 * Persistence layer 3 (PTY-side keep-alive): detaching a listener does NOT kill
 * the process. Only an explicit closePtySession() or the idle reaper does.
 *
 * The single most common "claude won't start inside the terminal" bug lives
 * here: CLAUDECODE must be stripped from the child env, or a nested Claude
 * refuses to launch.
 */
import os from 'node:os';
import * as pty from 'node-pty';
import type { WebSocket } from 'ws';

export interface CreateOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  shell?: string;
}

export interface SessionInfo {
  sessionId: string;
  cols: number;
  rows: number;
  shell: string;
  cwd: string;
  createdAt: number;
}

interface Session extends SessionInfo {
  proc: pty.IPty;
  listeners: Set<WebSocket>;
  /** Last time a listener was attached or activity occurred — drives the reaper. */
  lastActivity: number;
  exited: boolean;
}

const sessions = new Map<string, Session>();

const DEFAULT_SHELL =
  process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';

let reaperTimer: NodeJS.Timeout | undefined;
let idleReaperMs = 30 * 60 * 1000;

export function configureService(opts: { idleReaperMs?: number }): void {
  if (typeof opts.idleReaperMs === 'number') idleReaperMs = opts.idleReaperMs;
  ensureReaper();
}

function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env, TERM: 'xterm-256color' };
  // CRITICAL: without this, a nested Claude inherits the marker var and refuses to launch.
  delete (env as Record<string, string | undefined>).CLAUDECODE;
  return env;
}

export function createPtySession(opts: CreateOptions = {}): SessionInfo {
  const sessionId = cryptoRandomId();
  const cols = opts.cols ?? 80;
  const rows = opts.rows ?? 24;
  const shell = opts.shell || DEFAULT_SHELL;
  const cwd = opts.cwd || os.homedir();

  const proc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: childEnv(),
  });

  const session: Session = {
    sessionId,
    cols,
    rows,
    shell,
    cwd,
    createdAt: Date.now(),
    proc,
    listeners: new Set(),
    lastActivity: Date.now(),
    exited: false,
  };

  proc.onData((d) => {
    session.lastActivity = Date.now();
    broadcast(session, { t: 'data', sessionId, d });
  });

  proc.onExit(({ exitCode, signal }) => {
    session.exited = true;
    broadcast(session, { t: 'exit', sessionId, code: exitCode, signal });
    sessions.delete(sessionId);
  });

  sessions.set(sessionId, session);
  ensureReaper();
  return toInfo(session);
}

export function sessionExists(sessionId: string): boolean {
  const s = sessions.get(sessionId);
  return !!s && !s.exited;
}

export function getSessionInfo(sessionId: string): SessionInfo | undefined {
  const s = sessions.get(sessionId);
  return s ? toInfo(s) : undefined;
}

/** Attach a listener socket. Returns false if the session is unknown/dead. */
export function attachListener(sessionId: string, ws: WebSocket): boolean {
  const s = sessions.get(sessionId);
  if (!s || s.exited) return false;
  s.listeners.add(ws);
  s.lastActivity = Date.now();
  return true;
}

export function detachListener(sessionId: string, ws: WebSocket): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  s.listeners.delete(ws);
  // Intentionally do NOT kill the proc — persistence layer 3.
  s.lastActivity = Date.now();
}

export function writePty(sessionId: string, data: string): void {
  const s = sessions.get(sessionId);
  if (!s || s.exited) return;
  s.lastActivity = Date.now();
  s.proc.write(data);
}

export function resizePty(sessionId: string, cols: number, rows: number): void {
  const s = sessions.get(sessionId);
  if (!s || s.exited) return;
  s.cols = cols;
  s.rows = rows;
  try {
    s.proc.resize(cols, rows);
  } catch {
    /* resize can throw if the proc just exited; ignore */
  }
}

export function closePtySession(sessionId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  try {
    s.proc.kill();
  } catch {
    /* already dead */
  }
  sessions.delete(sessionId);
}

export function killAllSessions(): void {
  for (const id of [...sessions.keys()]) closePtySession(id);
}

export function listSessions(): SessionInfo[] {
  return [...sessions.values()].map(toInfo);
}

// --- internals --------------------------------------------------------------
function broadcast(session: Session, frame: unknown): void {
  const msg = JSON.stringify(frame);
  for (const ws of session.listeners) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(msg);
      } catch {
        /* drop on send failure; detach happens on the socket's close handler */
      }
    }
  }
}

function ensureReaper(): void {
  if (reaperTimer || idleReaperMs <= 0) return;
  reaperTimer = setInterval(() => {
    const now = Date.now();
    for (const s of sessions.values()) {
      const idle = now - s.lastActivity;
      if (s.listeners.size === 0 && idle > idleReaperMs) {
        closePtySession(s.sessionId);
      }
    }
  }, 60_000);
  // Don't keep the process alive solely for the reaper.
  reaperTimer.unref?.();
}

function toInfo(s: Session): SessionInfo {
  return {
    sessionId: s.sessionId,
    cols: s.cols,
    rows: s.rows,
    shell: s.shell,
    cwd: s.cwd,
    createdAt: s.createdAt,
  };
}

function cryptoRandomId(): string {
  // 16 bytes hex; node:crypto without importing the whole module surface.
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
