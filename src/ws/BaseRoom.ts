import { AuthenticatedWs, WsMessageType, send } from './types';

// ─── Pending request shape ────────────────────────────────────────────────────

/**
 * Generic pending invitation/request before a room is created.
 * Used by the static `pendingRequests` map in each concrete room class.
 */
export interface PendingRequest {
  from: AuthenticatedWs;
  /** `playerId` of the intended recipient. */
  to: string;
}

// ─── Room states ──────────────────────────────────────────────────────────────

export type RoomState = 'active' | 'ended';

// ─── BaseRoom ─────────────────────────────────────────────────────────────────

/**
 * Abstract base for any two-player WebSocket room (battle, trade, etc.).
 *
 * @remarks
 * Centralises the lifecycle concerns shared by every room type:
 * - Unique ID generation
 * - Player1 / Player2 references + `roomId` assignment on both sockets
 * - State machine (`active` → `ended`)
 * - Typed broadcast helpers (`sendTo`, `broadcast`, `sendToOpponent`)
 * - Abstract `close()` hook so subclasses can run their own teardown before
 *   the base removes the room from its registry and clears `roomId`.
 *
 * Subclasses are expected to:
 * 1. Maintain their own `static activeRooms` map keyed by room ID.
 * 2. Maintain their own `static pendingRequests` map keyed by requester playerId.
 * 3. Call `super(player1, player2, prefix)` in their constructor.
 * 4. Implement `close(reason?)` — call `super.close()` **last**.
 */
export abstract class BaseRoom {
  readonly id: string;
  readonly player1: AuthenticatedWs;
  readonly player2: AuthenticatedWs;

  protected _state: RoomState = 'active';

  // ── Constructor ─────────────────────────────────────────────────────────────

  constructor(
    player1: AuthenticatedWs,
    player2: AuthenticatedWs,
    /** Prefix used for the generated ID, e.g. `"battle"` or `"trade"`. */
    idPrefix: string,
  ) {
    this.id = BaseRoom.generateId(idPrefix);
    this.player1 = player1;
    this.player2 = player2;

    // Assign the room to both sockets immediately
    this.player1.roomId = this.id;
    this.player2.roomId = this.id;
  }

  // ── Accessors ───────────────────────────────────────────────────────────────

  get state(): RoomState {
    return this._state;
  }

  get isActive(): boolean {
    return this._state === 'active';
  }

  // ── Player helpers ───────────────────────────────────────────────────────────

  /**
   * Returns the opponent of the given player, or `undefined` if not found.
   */
  opponentOf(ws: AuthenticatedWs): AuthenticatedWs | undefined {
    if (ws.playerId === this.player1.playerId) return this.player2;
    if (ws.playerId === this.player2.playerId) return this.player1;
    return undefined;
  }

  /**
   * Returns `true` if the given socket belongs to one of the room's players.
   */
  includes(ws: AuthenticatedWs): boolean {
    return (
      ws.playerId === this.player1.playerId ||
      ws.playerId === this.player2.playerId
    );
  }

  // ── Send helpers ─────────────────────────────────────────────────────────────

  /** Send a message to a specific player. */
  sendTo(ws: AuthenticatedWs, type: WsMessageType, payload?: unknown): void {
    send(ws, type, payload);
  }

  /** Broadcast the same message to both players. */
  broadcast(type: WsMessageType, payload?: unknown): void {
    send(this.player1, type, payload);
    send(this.player2, type, payload);
  }

  /**
   * Send a message **only** to the opponent of the given player.
   * No-ops silently if `ws` is not in this room.
   */
  sendToOpponent(
    ws: AuthenticatedWs,
    type: WsMessageType,
    payload?: unknown,
  ): void {
    const opponent = this.opponentOf(ws);
    if (opponent) send(opponent, type, payload);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Teardown hook called when the room ends for any reason.
   *
   * @remarks
   * Subclasses **must** override this and call `super.close()` **at the end**
   * so the base can:
   * - Mark the room as `"ended"`
   * - Clear `roomId` on both sockets
   *
   * Subclasses are responsible for removing themselves from their own
   * `activeRooms` map before or after calling `super.close()`.
   */
  close(): void {
    this._state = 'ended';
    this.player1.roomId = undefined;
    this.player2.roomId = undefined;
  }

  // ── Static helpers ───────────────────────────────────────────────────────────

  /** Generates a time-based unique room ID with a given prefix. */
  static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
}
