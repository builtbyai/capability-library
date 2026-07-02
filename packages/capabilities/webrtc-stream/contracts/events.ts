/**
 * webrtc-stream contracts.
 *
 * Two layers behind one capability:
 *   1. Room layer (high-level): create a room, get a /j/<slug> shareable link,
 *      manage host + guests, persist chat. This is what most callers use.
 *   2. Session layer (low-level): SDP offer/answer + ICE candidate exchange.
 *      Used by the WebRTC machinery inside a room.
 *
 * Signaling goes through `dashboard-signaling.example.workers.dev` (same
 * Worker `wts-scheduler` uses). DataChannel carries chat; media tracks carry
 * a/v.
 */
import { z } from 'zod';

// ============================================================================
// Room layer
// ============================================================================

export const RoomRoleSchema = z.enum(['host', 'guest']);
export type RoomRole = z.infer<typeof RoomRoleSchema>;

export const RoomStatusSchema = z.enum(['created', 'opened', 'ended', 'expired']);
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

export const RoomConfigSchema = z.object({
  title: z.string().min(1).max(120),
  /** Optional host display name (shown on the join screen). */
  hostName: z.string().optional(),
  /** ISO timestamp the room should "open" for guest join. */
  startAt: z.string().datetime(),
  /** Minutes before startAt that guests can join. Default RTC_JOIN_OPEN_BEFORE_MIN env. */
  joinOpenBeforeMin: z.number().int().min(0).max(60).default(5),
  /** Hard expiration: after this, slug returns 410 Gone. Defaults to startAt + 6h. */
  expiresAt: z.string().datetime().optional(),
  /** If true, guests must enter a name before joining (visible in PeerList). */
  requireGuestName: z.boolean().default(true),
  /** If true, chat is persisted to D1. If false, chat is in-memory only and lost on room end. */
  persistChat: z.boolean().default(false),
});
export type RoomConfig = z.infer<typeof RoomConfigSchema>;

export const RoomSchema = z.object({
  roomId: z.string().uuid(),
  /** Short URL slug (8 chars base62, no 0/O/1/I/l for legibility) - same pattern as wts-scheduler. */
  slug: z.string().regex(/^[A-Za-z0-9]{6,16}$/),
  status: RoomStatusSchema,
  config: RoomConfigSchema,
  /** Public URL for guests: PUBLIC_BASE + "/j/" + slug. */
  joinUrl: z.string().url(),
  /** Host-only URL that bypasses the joinOpenBeforeMin window. */
  hostUrl: z.string().url(),
  createdAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
});
export type Room = z.infer<typeof RoomSchema>;

export const ParticipantSchema = z.object({
  peerId: z.string().uuid(),
  roomId: z.string().uuid(),
  role: RoomRoleSchema,
  displayName: z.string(),
  joinedAt: z.string().datetime(),
  /** Last heartbeat from this peer's signaling channel. */
  lastSeenAt: z.string().datetime(),
});
export type Participant = z.infer<typeof ParticipantSchema>;

// ============================================================================
// Chat layer (DataChannel-backed; optionally persisted to D1)
// ============================================================================

export const ChatMessageSchema = z.object({
  messageId: z.string().uuid(),
  roomId: z.string().uuid(),
  fromPeerId: z.string().uuid(),
  fromDisplayName: z.string(),
  text: z.string().max(2000),
  /** ISO. Server-stamped; clients can't backdate. */
  at: z.string().datetime(),
  /** In-band signaling: pinned by host, system notice, etc. */
  kind: z.enum(['text', 'system', 'pinned']).default('text'),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ============================================================================
// Low-level signaling (SDP + ICE)
// ============================================================================

export const SdpSchema = z.object({
  type: z.enum(['offer', 'answer']),
  sdp: z.string(),
});

export const IceCandidateSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nullable().optional(),
});

export const SignalingSessionSchema = z.object({
  sessionId: z.string().uuid(),
  roomId: z.string().uuid(),
  fromPeerId: z.string().uuid(),
  toPeerId: z.string().uuid(),
  state: z.enum(['offered', 'answered', 'connected', 'failed', 'closed']),
  createdAt: z.string().datetime(),
});

// ============================================================================
// Events
// ============================================================================

export const RoomCreatedEvent       = z.object({ event: z.literal('rtc.room.created'),  room: RoomSchema });
export const RoomOpenedEvent        = z.object({ event: z.literal('rtc.room.opened'),   roomId: z.string().uuid(), at: z.string() });
export const RoomEndedEvent         = z.object({ event: z.literal('rtc.room.ended'),    roomId: z.string().uuid(), endedBy: z.enum(['host', 'system', 'expired']), at: z.string() });
export const RoomExpiredEvent       = z.object({ event: z.literal('rtc.room.expired'),  roomId: z.string().uuid(), at: z.string() });

export const PeerJoinedEvent        = z.object({ event: z.literal('rtc.peer.joined'),     participant: ParticipantSchema });
export const PeerLeftEvent          = z.object({ event: z.literal('rtc.peer.left'),       roomId: z.string().uuid(), peerId: z.string().uuid(), at: z.string() });
export const PeerKickedEvent        = z.object({ event: z.literal('rtc.peer.kicked'),     roomId: z.string().uuid(), peerId: z.string().uuid(), by: z.enum(['host', 'system']), at: z.string() });

export const SessionOpenedEvent     = z.object({ event: z.literal('rtc.session.opened'),  session: SignalingSessionSchema });
export const PeerConnectedEvent     = z.object({ event: z.literal('rtc.peer.connected'),  sessionId: z.string().uuid(), at: z.string() });
export const PeerDisconnectedEvent  = z.object({ event: z.literal('rtc.peer.disconnected'), sessionId: z.string().uuid(), reason: z.string().optional(), at: z.string() });
export const StatsTickEvent         = z.object({ event: z.literal('rtc.stats.tick'),      sessionId: z.string().uuid(), inboundKbps: z.number(), outboundKbps: z.number(), packetLossPct: z.number(), rttMs: z.number(), at: z.string() });
export const SignalingFailedEvent   = z.object({ event: z.literal('rtc.signaling.failed'), sessionId: z.string().uuid().optional(), code: z.string(), detail: z.string() });

export const ChatMessageSentEvent      = z.object({ event: z.literal('rtc.chat.message.sent'),     message: ChatMessageSchema });
export const ChatMessageReceivedEvent  = z.object({ event: z.literal('rtc.chat.message.received'), message: ChatMessageSchema });

export const EVENT_NAMES = {
  roomCreated:    'rtc.room.created',
  roomOpened:     'rtc.room.opened',
  roomEnded:      'rtc.room.ended',
  roomExpired:    'rtc.room.expired',
  peerJoined:     'rtc.peer.joined',
  peerLeft:       'rtc.peer.left',
  peerKicked:     'rtc.peer.kicked',
  sessionOpened:  'rtc.session.opened',
  peerConnected:  'rtc.peer.connected',
  peerDisconnected: 'rtc.peer.disconnected',
  statsTick:      'rtc.stats.tick',
  signalingFailed:'rtc.signaling.failed',
  chatSent:       'rtc.chat.message.sent',
  chatReceived:   'rtc.chat.message.received',
} as const;

// ============================================================================
// Port
// ============================================================================

export interface WebRtcStreamPort {
  /** Create a room. Returns the room + joinUrl + hostUrl. */
  createRoom(input: RoomConfig): Promise<Room>;
  /** Get public room metadata by slug. Returns null if expired or never existed. */
  getRoomBySlug(slug: string): Promise<Room | null>;
  /** Host ends a room early. Revokes all guest tokens; emits rtc.room.ended. */
  endRoom(roomId: string): Promise<void>;
  /** Live peer list for a room. */
  listParticipants(roomId: string): Promise<Participant[]>;
  /** Get a fresh short-TTL TURN credential for the calling client. */
  issueTurnCredential(roomId: string, peerId: string): Promise<{ username: string; credential: string; expiresAt: string }>;
  /** Chat: post a message. Server stamps `at` + `messageId`. */
  postChatMessage(roomId: string, peerId: string, text: string): Promise<ChatMessage>;
  /** Chat: list messages since a cursor (messageId). */
  listChatMessages(roomId: string, sinceCursor?: string): Promise<ChatMessage[]>;
}

// ============================================================================
// Short-slug generator (mirrors wts-scheduler/worker/index.js#generateSlug)
// ============================================================================

/** Base62 alphabet excluding visually-ambiguous chars (0, O, 1, I, l). */
export const SLUG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Generate an 8-char short slug suitable for /j/<slug> URLs. */
export function generateSlug(len = 8): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('crypto.getRandomValues not available');
  }
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[bytes[i]! % SLUG_ALPHABET.length];
  return out;
}
