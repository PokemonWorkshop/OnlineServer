import { AuthenticatedWs, send } from '../types';
import { BaseRoom, PendingRequest } from '../BaseRoom';

// ─── BattleRoom ───────────────────────────────────────────────────────────────

/**
 * An active battle room shared between two players.
 *
 * @remarks
 * Extends {@link BaseRoom} with battle-specific state:
 * - Turn tracking
 * - Win/loss resolution via `end()`
 */
class BattleRoom extends BaseRoom {
  /** `playerId` of the player whose turn it currently is. */
  turn: string;

  // ── Static registry ─────────────────────────────────────────────────────────

  static readonly activeRooms = new Map<string, BattleRoom>();
  static readonly pendingChallenges = new Map<string, PendingRequest>();

  // ── Constructor ─────────────────────────────────────────────────────────────

  constructor(player1: AuthenticatedWs, player2: AuthenticatedWs) {
    super(player1, player2, 'battle');
    this.turn = player1.playerId;

    BattleRoom.activeRooms.set(this.id, this);
  }

  // ── Battle-specific helpers ──────────────────────────────────────────────────

  /** Advance the turn to the opponent of the current turn holder. */
  advanceTurn(): void {
    const current =
      this.player1.playerId === this.turn ? this.player1 : this.player2;
    const next = this.opponentOf(current)!;
    this.turn = next.playerId;
  }

  /**
   * Terminate the battle: broadcast `BATTLE_END` with the result then close.
   */
  end(winner: string | null, reason: string): void {
    if (!this.isActive) return;

    this.broadcast('BATTLE_END', { winner, reason });
    this.close();
  }

  // ── Lifecycle override ───────────────────────────────────────────────────────

  /** Remove from registry then delegate to base teardown. */
  override close(): void {
    BattleRoom.activeRooms.delete(this.id);
    super.close();
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Routes all `BATTLE_*` WebSocket messages to the appropriate logic.
 *
 * @remarks
 * Called by {@link createWsServer} for every message whose `type` starts with `BATTLE_`.
 *
 * Supported messages:
 * - `BATTLE_CHALLENGE` — challenge a connected player
 * - `BATTLE_ACCEPT`    — accept a pending challenge and start a room
 * - `BATTLE_DECLINE`   — decline a pending challenge
 * - `BATTLE_ACTION`    — relay an action to the opponent and advance the turn
 * - `BATTLE_END`       — terminate the room and notify both players
 *
 * @param ws      - Socket of the player who sent the message.
 * @param type    - Message type (e.g. `"BATTLE_CHALLENGE"`).
 * @param payload - Raw message payload (validated inline per case).
 * @param clients - Global connected-clients map used to locate targets.
 */
export function handleBattleMessage(
  ws: AuthenticatedWs,
  type: string,
  payload: any,
  clients: Map<string, AuthenticatedWs>,
): void {
  switch (type) {
    // ── Send a challenge ──────────────────────────────────────────────────────
    case 'BATTLE_CHALLENGE': {
      const target = clients.get(payload?.targetPlayerId);
      if (!target) {
        send(ws, 'ERROR', { message: 'Player not found or offline' });
        return;
      }
      if (ws.roomId) {
        send(ws, 'ERROR', { message: 'You are already in a battle' });
        return;
      }
      if (BattleRoom.pendingChallenges.has(ws.playerId)) {
        send(ws, 'ERROR', { message: 'A challenge is already pending' });
        return;
      }

      BattleRoom.pendingChallenges.set(ws.playerId, {
        from: ws,
        to: payload.targetPlayerId,
      });
      send(target, 'BATTLE_CHALLENGE', {
        challengerId: ws.playerId,
        challengerName: ws.trainerName,
      });
      break;
    }

    // ── Accept a challenge ────────────────────────────────────────────────────
    case 'BATTLE_ACCEPT': {
      const challenge = BattleRoom.pendingChallenges.get(payload?.challengerId);
      if (!challenge || challenge.to !== ws.playerId) {
        send(ws, 'ERROR', {
          message: 'No challenge to accept from this player',
        });
        return;
      }
      if (ws.roomId) {
        send(ws, 'ERROR', { message: 'You are already in a battle' });
        return;
      }

      BattleRoom.pendingChallenges.delete(payload.challengerId);

      const room = new BattleRoom(challenge.from, ws);
      const state = {
        roomId: room.id,
        turn: room.turn,
        player1: {
          id: challenge.from.playerId,
          name: challenge.from.trainerName,
        },
        player2: { id: ws.playerId, name: ws.trainerName },
      };

      room.broadcast('BATTLE_STATE', state);
      break;
    }

    // ── Decline a challenge ───────────────────────────────────────────────────
    case 'BATTLE_DECLINE': {
      const challenge = BattleRoom.pendingChallenges.get(payload?.challengerId);
      if (challenge) {
        BattleRoom.pendingChallenges.delete(payload.challengerId);
        send(challenge.from, 'BATTLE_DECLINE', { by: ws.trainerName });
      }
      break;
    }

    // ── Submit a battle action ────────────────────────────────────────────────
    case 'BATTLE_ACTION': {
      if (!ws.roomId) {
        send(ws, 'ERROR', { message: 'You are not in a battle' });
        return;
      }

      const room = BattleRoom.activeRooms.get(ws.roomId);
      if (!room || !room.isActive) return;
      if (room.turn !== ws.playerId) {
        send(ws, 'ERROR', { message: 'It is not your turn' });
        return;
      }

      // Relay the action opaquely to the opponent
      room.sendToOpponent(ws, 'BATTLE_ACTION', {
        from: ws.playerId,
        action: payload,
      });

      // Advance turn and broadcast new state
      room.advanceTurn();
      room.broadcast('BATTLE_STATE', { roomId: room.id, turn: room.turn });
      break;
    }

    // ── End the battle ────────────────────────────────────────────────────────
    case 'BATTLE_END': {
      if (!ws.roomId) return;
      const room = BattleRoom.activeRooms.get(ws.roomId);
      room?.end(payload?.winner ?? null, payload?.reason ?? 'normal');
      break;
    }
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Cleans up battle state for a disconnecting player.
 *
 * @remarks
 * Called by {@link createWsServer} inside the `ws.on('close')` handler.
 * If the player was in a room, the opponent receives a `BATTLE_END` message
 * with `reason: "opponent_disconnected"` and is declared the winner.
 *
 * @param ws - The socket that is closing.
 */
export function cleanupBattle(ws: AuthenticatedWs): void {
  BattleRoom.pendingChallenges.delete(ws.playerId);

  if (ws.roomId) {
    const room = BattleRoom.activeRooms.get(ws.roomId);
    if (room) {
      const opponent = room.opponentOf(ws);
      room.end(opponent?.playerId ?? null, 'opponent_disconnected');
    }
  }
}
