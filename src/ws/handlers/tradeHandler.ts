import { AuthenticatedWs, send } from '../types';
import { BaseRoom, PendingRequest } from '../BaseRoom';

// ─── TradeSession ─────────────────────────────────────────────────────────────

/**
 * An active trade session between two players.
 *
 * @remarks
 * Extends {@link BaseRoom} with trade-specific state:
 * - Per-player offers
 * - Double-confirmation logic (both must confirm before the swap executes)
 * Changing an offer resets both confirmations.
 */
class TradeSession extends BaseRoom {
  /** Creature currently offered by player 1, or `undefined` if not yet placed. */
  offer1?: Record<string, unknown>;
  /** Creature currently offered by player 2, or `undefined` if not yet placed. */
  offer2?: Record<string, unknown>;
  /** Whether player 1 has confirmed the current offers. */
  confirmed1 = false;
  /** Whether player 2 has confirmed the current offers. */
  confirmed2 = false;

  // ── Static registry ─────────────────────────────────────────────────────────

  static readonly activeTrades = new Map<string, TradeSession>();
  static readonly pendingRequests = new Map<string, PendingRequest>();

  // ── Constructor ─────────────────────────────────────────────────────────────

  constructor(player1: AuthenticatedWs, player2: AuthenticatedWs) {
    super(player1, player2, 'trade');
    TradeSession.activeTrades.set(this.id, this);
  }

  // ── Trade-specific helpers ───────────────────────────────────────────────────

  /**
   * Update an offer for the given player and reset both confirmations.
   * @returns `true` if `ws` is a participant, `false` otherwise.
   */
  setOffer(ws: AuthenticatedWs, creature: Record<string, unknown>): boolean {
    const isP1 = ws.playerId === this.player1.playerId;
    const isP2 = ws.playerId === this.player2.playerId;

    if (!isP1 && !isP2) return false;

    if (isP1) this.offer1 = creature;
    else this.offer2 = creature;

    // Reset confirmations whenever an offer changes
    this.confirmed1 = false;
    this.confirmed2 = false;

    return true;
  }

  /**
   * Mark the given player's confirmation.
   * @returns `true` if both players have now confirmed **and** placed offers.
   */
  confirm(ws: AuthenticatedWs): boolean {
    const isP1 = ws.playerId === this.player1.playerId;
    if (isP1) this.confirmed1 = true;
    else this.confirmed2 = true;

    return this.confirmed1 && this.confirmed2 && !!this.offer1 && !!this.offer2;
  }

  /**
   * Execute the swap and close the session.
   * Sends `TRADE_COMPLETE` to each player with their newly received creature.
   */
  complete(): void {
    this.sendTo(this.player1, 'TRADE_COMPLETE', {
      yourNewCreature: this.offer2,
    });
    this.sendTo(this.player2, 'TRADE_COMPLETE', {
      yourNewCreature: this.offer1,
    });
    this.close();
  }

  // ── Lifecycle override ───────────────────────────────────────────────────────

  /** Remove from registry then delegate to base teardown. */
  override close(): void {
    TradeSession.activeTrades.delete(this.id);
    super.close();
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Routes all `TRADE_*` WebSocket messages to the appropriate logic.
 *
 * @remarks
 * Called by {@link createWsServer} for every message whose `type` starts with `TRADE_`.
 *
 * Supported messages:
 * - `TRADE_REQUEST` — propose a trade to a connected player
 * - `TRADE_ACCEPT`  — accept a pending request and open a session
 * - `TRADE_DECLINE` — decline a pending request
 * - `TRADE_OFFER`   — place or update a creature on the trade table (resets confirmations)
 * - `TRADE_CONFIRM` — lock in the current offers; completes the trade when both confirm
 * - `TRADE_CANCEL`  — abort the session and notify the opponent
 *
 * @param ws      - Socket of the player who sent the message.
 * @param type    - Message type (e.g. `"TRADE_REQUEST"`).
 * @param payload - Raw message payload (validated inline per case).
 * @param clients - Global connected-clients map used to locate targets.
 */
export function handleTradeMessage(
  ws: AuthenticatedWs,
  type: string,
  payload: any,
  clients: Map<string, AuthenticatedWs>,
): void {
  switch (type) {
    // ── Send a trade request ──────────────────────────────────────────────────
    case 'TRADE_REQUEST': {
      const target = clients.get(payload?.targetPlayerId);
      if (!target) {
        send(ws, 'ERROR', { message: 'Player not found or offline' });
        return;
      }
      if (ws.roomId) {
        send(ws, 'ERROR', { message: 'You are already in a trade' });
        return;
      }

      TradeSession.pendingRequests.set(ws.playerId, {
        from: ws,
        to: payload.targetPlayerId,
      });
      send(target, 'TRADE_REQUEST', {
        requesterId: ws.playerId,
        requesterName: ws.trainerName,
      });
      break;
    }

    // ── Accept the trade ──────────────────────────────────────────────────────
    case 'TRADE_ACCEPT': {
      const pending = TradeSession.pendingRequests.get(payload?.requesterId);
      if (!pending || pending.to !== ws.playerId) {
        send(ws, 'ERROR', {
          message: 'No trade request to accept from this player',
        });
        return;
      }
      if (ws.roomId) {
        send(ws, 'ERROR', { message: 'You are already in a trade' });
        return;
      }

      TradeSession.pendingRequests.delete(payload.requesterId);

      const session = new TradeSession(pending.from, ws);

      session.sendTo(pending.from, 'TRADE_ACCEPT', { sessionId: session.id });
      session.sendTo(ws, 'TRADE_ACCEPT', { sessionId: session.id });
      break;
    }

    // ── Decline the trade ─────────────────────────────────────────────────────
    case 'TRADE_DECLINE': {
      const pending = TradeSession.pendingRequests.get(payload?.requesterId);
      if (pending) {
        TradeSession.pendingRequests.delete(payload.requesterId);
        send(pending.from, 'TRADE_DECLINE', { by: ws.trainerName });
      }
      break;
    }

    // ── Place a creature on the trade table ───────────────────────────────────
    case 'TRADE_OFFER': {
      if (!ws.roomId) {
        send(ws, 'ERROR', { message: 'You are not in a trade' });
        return;
      }

      const session = TradeSession.activeTrades.get(ws.roomId);
      if (!session) return;

      session.setOffer(ws, payload?.creature);
      session.sendToOpponent(ws, 'TRADE_OFFER', {
        from: ws.playerId,
        creature: payload?.creature,
      });
      break;
    }

    // ── Confirm the current offers ────────────────────────────────────────────
    case 'TRADE_CONFIRM': {
      if (!ws.roomId) return;

      const session = TradeSession.activeTrades.get(ws.roomId);
      if (!session) return;

      const bothConfirmed = session.confirm(ws);
      session.sendToOpponent(ws, 'TRADE_CONFIRM', { from: ws.playerId });

      if (bothConfirmed) {
        session.complete();
      }
      break;
    }

    // ── Cancel the trade ──────────────────────────────────────────────────────
    case 'TRADE_CANCEL': {
      if (!ws.roomId) return;

      const session = TradeSession.activeTrades.get(ws.roomId);
      if (!session) return;

      session.sendToOpponent(ws, 'TRADE_CANCEL', { by: ws.trainerName });
      session.close();
      break;
    }
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Cleans up trade state for a disconnecting player.
 *
 * @remarks
 * Called by {@link createWsServer} inside the `ws.on('close')` handler.
 * If the player was in a session, the opponent receives a `TRADE_CANCEL` message
 * with `reason: "disconnected"`.
 *
 * @param ws - The socket that is closing.
 */
export function cleanupTrade(ws: AuthenticatedWs): void {
  TradeSession.pendingRequests.delete(ws.playerId);

  if (ws.roomId) {
    const session = TradeSession.activeTrades.get(ws.roomId);
    if (session) {
      session.sendToOpponent(ws, 'TRADE_CANCEL', {
        by: ws.trainerName,
        reason: 'disconnected',
      });
      session.close();
    }
  }
}
