import { WebSocket } from 'ws';

// ─── Socket type ──────────────────────────────────────────────────────────────

/**
 * Authenticated WebSocket — enriched with player metadata after the WS handshake.
 *
 * @remarks
 * The raw `WebSocket` is cast to this interface once `playerId` and `trainerName`
 * have been validated. `roomId` is set by battle/trade handlers when the player
 * joins a room and cleared when they leave.
 */
export interface AuthenticatedWs extends WebSocket {
  /** Immutable game-side player identifier. */
  playerId:    string;
  /** Display name — may differ from the registered one if updated since login. */
  trainerName: string;
  /** ID of the active battle or trade room, or `undefined` when idle. */
  roomId?:     string;
}

// ─── Message types ────────────────────────────────────────────────────────────

/**
 * All WebSocket message type literals exchanged between clients and server.
 *
 * @remarks
 * Naming convention: `<FEATURE>_<ACTION>`.
 * - `A → server` messages are sent by a client to initiate an action.
 * - `server → players` messages are broadcast by the server to one or both players.
 */
export type WsMessageType =
  // ── Battle ────────────────────────────────────────────────────────────────
  | 'BATTLE_CHALLENGE'  // client A → server : challenge player B
  | 'BATTLE_ACCEPT'     // client B → server : accept the challenge
  | 'BATTLE_DECLINE'    // client B → server : decline the challenge
  | 'BATTLE_ACTION'     // client  → server  : submit a battle action (relayed to opponent)
  | 'BATTLE_STATE'      // server  → clients : broadcast the current room state
  | 'BATTLE_END'        // server  → clients : notify that the battle has ended
  // ── Trade ─────────────────────────────────────────────────────────────────
  | 'TRADE_REQUEST'     // client A → server : propose a trade to player B
  | 'TRADE_ACCEPT'      // client B → server : accept the trade request
  | 'TRADE_DECLINE'     // client B → server : decline the trade request
  | 'TRADE_OFFER'       // client  → server  : place/update a creature on the trade table
  | 'TRADE_CONFIRM'     // client  → server  : lock in the current offer
  | 'TRADE_CANCEL'      // client  → server  : cancel the ongoing trade
  | 'TRADE_COMPLETE'    // server  → clients : trade executed, creatures swapped
  // ── System ────────────────────────────────────────────────────────────────
  | 'PING'   // client → server : keepalive probe
  | 'PONG'   // server → client : keepalive response
  | 'ERROR'; // server → client : error notification

// ─── Message envelope ─────────────────────────────────────────────────────────

/**
 * Standard message envelope sent over the WebSocket connection.
 */
export interface WsMessage {
  type:     WsMessageType;
  payload?: unknown;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Sends a JSON-encoded message to a socket **only if** the connection is open.
 *
 * @remarks
 * Silently drops the message if `ws.readyState !== OPEN` to avoid throwing
 * on disconnected sockets.
 *
 * @param ws      - Target socket.
 * @param type    - Message type.
 * @param payload - Optional payload (must be JSON-serialisable).
 */
export function send(ws: WebSocket, type: WsMessageType, payload?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload } satisfies WsMessage));
  }
}
