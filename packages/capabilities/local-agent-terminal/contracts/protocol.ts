/**
 * The PTY wire protocol — JSON over text WebSocket frames.
 *
 * One schema, three speakers (browser, Durable Object, bridge daemon). The DO
 * never inspects the payload beyond `sessionId`; the bridge translates these
 * frames to/from node-pty's write()/onData().
 *
 * These types are the stable contract. If you change a frame here, every
 * speaker must change together.
 */

// ---------------------------------------------------------------------------
// Bridge <-> Durable Object
// ---------------------------------------------------------------------------
export interface HelloFrame {
  t: 'hello';
  host: string;
  pid: number;
  version: string;
  startedAt: string;
}
export interface BridgeAckFrame {
  t: 'bridge-ack';
  at: string;
  previousDisconnect?: { host: string; at: string; code?: number };
}
export interface RejectedFrame {
  t: 'rejected';
  reason: string;
  holder: { host: string; pid: number; startedAt: string };
  retryAfterMs: number;
}
export interface PingFrame {
  t: 'ping';
  ts: number;
}
export interface PongFrame {
  t: 'pong';
  ts: number;
}

// ---------------------------------------------------------------------------
// Browser -> Bridge (per session)
// ---------------------------------------------------------------------------
export interface SpawnFrame {
  t: 'spawn';
  sessionId: string;
  cols: number;
  rows: number;
  cwd?: string;
  shell?: string;
}
export interface AttachFrame {
  t: 'attach';
  sessionId: string;
  cols: number;
  rows: number;
}
export interface DataInFrame {
  t: 'data';
  sessionId: string;
  d: string;
}
export interface ResizeFrame {
  t: 'resize';
  sessionId: string;
  cols: number;
  rows: number;
}
export interface KillFrame {
  t: 'kill';
  sessionId: string;
}
export interface CloseFrame {
  t: 'close';
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Bridge -> Browser (per session)
// ---------------------------------------------------------------------------
export interface SpawnedFrame {
  t: 'spawned';
  sessionId: string;
  ok: boolean;
  error?: string;
  cols?: number;
  rows?: number;
  shell?: string;
  /** Present on synthesized failures from the DO when no bridge is attached. */
  diag?: { lastDisconnect?: unknown; conflicts?: number; lastConflict?: unknown };
}
export interface AttachedFrame {
  t: 'attached';
  sessionId: string;
  ok: boolean;
  error?: string;
  cols?: number;
  rows?: number;
}
export interface DataOutFrame {
  t: 'data';
  sessionId: string;
  d: string;
}
export interface ExitFrame {
  t: 'exit';
  sessionId: string;
  code: number;
  signal?: number;
}
export interface BridgeDownFrame {
  t: 'bridge-down';
  sessionId: string;
  reason: string;
  code: number;
  host: string;
}
export interface ErrorFrame {
  t: 'error';
  message: string;
}

export type BridgeToDo = HelloFrame | PingFrame | PongFrame;
export type DoToBridge = BridgeAckFrame | RejectedFrame | PingFrame | PongFrame;

export type ClientToHost =
  | SpawnFrame
  | AttachFrame
  | DataInFrame
  | ResizeFrame
  | KillFrame
  | CloseFrame;

export type HostToClient =
  | SpawnedFrame
  | AttachedFrame
  | DataOutFrame
  | ExitFrame
  | BridgeDownFrame
  | ErrorFrame;

export type AnyFrame = ClientToHost | HostToClient | BridgeToDo | DoToBridge;

/** Narrow a parsed frame by its discriminant. */
export function isFrame<K extends AnyFrame['t']>(
  frame: AnyFrame,
  t: K,
): frame is Extract<AnyFrame, { t: K }> {
  return frame.t === t;
}

/** Safe parse a raw WS payload into a frame, or null if it isn't JSON-with-`t`. */
export function parseFrame(raw: string): AnyFrame | null {
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj.t === 'string' ? (obj as AnyFrame) : null;
  } catch {
    return null;
  }
}

// Close codes used across the relay (documented for the runbook).
export const CLOSE_CODES = {
  NO_SESSION: 4040,
  ANOTHER_BRIDGE: 4001,
} as const;
