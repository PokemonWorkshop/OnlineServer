import { AuthenticatedWs, send } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * An active trade session between two players.
 *
 * @remarks
 * A session becomes "complete" when both players have placed an offer
 * **and** both have confirmed. Changing an offer resets both confirmations.
 */
interface TradeSession {
  /** Unique session identifier (format: `trade_<ts>_<rand>`). */
  id:         string;
  player1:    AuthenticatedWs;
  player2:    AuthenticatedWs;
  /** Creature currently offered by player 1, or `undefined` if not yet placed. */
  offer1?:    Record<string, unknown>;
  /** Creature currently offered by player 2, or `undefined` if not yet placed. */
  offer2?:    Record<string, unknown>;
  /** Whether player 1 has confirmed the current offers. */
  confirmed1: boolean;
  /** Whether player 2 has confirmed the current offers. */
  confirmed2: boolean;
}

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Pending trade requests indexed by the requester's `playerId`.
 * @internal
 */
const pendingTrades = new Map<string, { from: AuthenticatedWs; to: string }>();

/**
 * Active trade sessions indexed by `sessionId`.
 * @internal
 */
const activeTrades = new Map<string, TradeSession>();

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
  ws:      AuthenticatedWs,
  type:    string,
  payload: any,
  clients: Map<string, AuthenticatedWs>,
): void {
  switch (type) {

    // ── Send a trade request ────────────────────────────────────────────────
    case 'TRADE_REQUEST': {
      const target = clients.get(payload?.targetPlayerId);
      if (!target)  { send(ws, 'ERROR', { message: 'Player not found or offline' }); return; }
      if (ws.roomId){ send(ws, 'ERROR', { message: 'You are already in a trade' });  return; }

      pendingTrades.set(ws.playerId, { from: ws, to: payload.targetPlayerId });
      send(target, 'TRADE_REQUEST', { requesterId: ws.playerId, requesterName: ws.trainerName });
      break;
    }

    // ── Accept the trade ────────────────────────────────────────────────────
    case 'TRADE_ACCEPT': {
      const pending = pendingTrades.get(payload?.requesterId);
      if (!pending || pending.to !== ws.playerId) { send(ws, 'ERROR', { message: 'No trade request to accept from this player' }); return; }
      if (ws.roomId)                              { send(ws, 'ERROR', { message: 'You are already in a trade' }); return; }

      pendingTrades.delete(payload.requesterId);

      const sessionId = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const session: TradeSession = {
        id:         sessionId,
        player1:    pending.from,
        player2:    ws,
        confirmed1: false,
        confirmed2: false,
      };

      activeTrades.set(sessionId, session);
      pending.from.roomId = sessionId;
      ws.roomId           = sessionId;

      send(pending.from, 'TRADE_ACCEPT', { sessionId });
      send(ws,           'TRADE_ACCEPT', { sessionId });
      break;
    }

    // ── Decline the trade ───────────────────────────────────────────────────
    case 'TRADE_DECLINE': {
      const pending = pendingTrades.get(payload?.requesterId);
      if (pending) {
        pendingTrades.delete(payload.requesterId);
        send(pending.from, 'TRADE_DECLINE', { by: ws.trainerName });
      }
      break;
    }

    // ── Place a creature on the trade table ─────────────────────────────────
    case 'TRADE_OFFER': {
      if (!ws.roomId) { send(ws, 'ERROR', { message: 'You are not in a trade' }); return; }

      const session = activeTrades.get(ws.roomId);
      if (!session) return;

      const isP1 = session.player1.playerId === ws.playerId;
      if (isP1) session.offer1 = payload?.creature;
      else      session.offer2 = payload?.creature;

      // Changing an offer resets both confirmations
      session.confirmed1 = false;
      session.confirmed2 = false;

      const opponent = isP1 ? session.player2 : session.player1;
      send(opponent, 'TRADE_OFFER', { from: ws.playerId, creature: payload?.creature });
      break;
    }

    // ── Confirm the current offers ──────────────────────────────────────────
    case 'TRADE_CONFIRM': {
      if (!ws.roomId) return;

      const session = activeTrades.get(ws.roomId);
      if (!session) return;

      const isP1 = session.player1.playerId === ws.playerId;
      if (isP1) session.confirmed1 = true;
      else      session.confirmed2 = true;

      const opponent = isP1 ? session.player2 : session.player1;
      send(opponent, 'TRADE_CONFIRM', { from: ws.playerId });

      // Both confirmed AND placed an offer → execute the trade
      if (session.confirmed1 && session.confirmed2 && session.offer1 && session.offer2) {
        send(session.player1, 'TRADE_COMPLETE', { yourNewCreature: session.offer2 });
        send(session.player2, 'TRADE_COMPLETE', { yourNewCreature: session.offer1 });
        closeTradeSession(session);
      }
      break;
    }

    // ── Cancel the trade ────────────────────────────────────────────────────
    case 'TRADE_CANCEL': {
      if (!ws.roomId) return;

      const session = activeTrades.get(ws.roomId);
      if (!session) return;

      const opponent = session.player1.playerId === ws.playerId ? session.player2 : session.player1;
      send(opponent, 'TRADE_CANCEL', { by: ws.trainerName });
      closeTradeSession(session);
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
  pendingTrades.delete(ws.playerId);

  if (ws.roomId) {
    const session = activeTrades.get(ws.roomId);
    if (session) {
      const opponent = session.player1.playerId === ws.playerId ? session.player2 : session.player1;
      send(opponent, 'TRADE_CANCEL', { by: ws.trainerName, reason: 'disconnected' });
      closeTradeSession(session);
    }
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Closes a trade session: clears both players' `roomId` and removes the session
 * from the active map.
 *
 * @param session - The session to close.
 * @internal
 */
function closeTradeSession(session: TradeSession): void {
  session.player1.roomId = undefined;
  session.player2.roomId = undefined;
  activeTrades.delete(session.id);
}
