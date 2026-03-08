import { AuthenticatedWs, send } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * An active battle room shared between two players.
 *
 * @remarks
 * Rooms are created when a challenge is accepted and destroyed when
 * `BATTLE_END` is received or a player disconnects.
 */
interface BattleRoom {
  /** Unique room identifier (format: `battle_<ts>_<rand>`). */
  id: string;
  player1: AuthenticatedWs;
  player2: AuthenticatedWs;
  state: 'active' | 'ended';
  /** `playerId` of the player whose turn it currently is. */
  turn: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Pending challenges indexed by the challenger's `playerId`.
 * An entry is created on `BATTLE_CHALLENGE` and removed on accept/decline.
 * @internal
 */
const pendingChallenges = new Map<
  string,
  { from: AuthenticatedWs; to: string }
>();

/**
 * Active battle rooms indexed by `roomId`.
 * @internal
 */
const activeRooms = new Map<string, BattleRoom>();

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
    // ── Send a challenge ────────────────────────────────────────────────────
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
      if (pendingChallenges.has(ws.playerId)) {
        send(ws, 'ERROR', { message: 'A challenge is already pending' });
        return;
      }

      pendingChallenges.set(ws.playerId, {
        from: ws,
        to: payload.targetPlayerId,
      });
      send(target, 'BATTLE_CHALLENGE', {
        challengerId: ws.playerId,
        challengerName: ws.trainerName,
      });
      break;
    }

    // ── Accept a challenge ──────────────────────────────────────────────────
    case 'BATTLE_ACCEPT': {
      const challenge = pendingChallenges.get(payload?.challengerId);
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

      pendingChallenges.delete(payload.challengerId);

      const roomId = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const room: BattleRoom = {
        id: roomId,
        player1: challenge.from,
        player2: ws,
        state: 'active',
        turn: challenge.from.playerId,
      };

      activeRooms.set(roomId, room);
      challenge.from.roomId = roomId;
      ws.roomId = roomId;

      const state = {
        roomId,
        turn: room.turn,
        player1: {
          id: challenge.from.playerId,
          name: challenge.from.trainerName,
        },
        player2: { id: ws.playerId, name: ws.trainerName },
      };
      send(challenge.from, 'BATTLE_STATE', state);
      send(ws, 'BATTLE_STATE', state);
      break;
    }

    // ── Decline a challenge ─────────────────────────────────────────────────
    case 'BATTLE_DECLINE': {
      const challenge = pendingChallenges.get(payload?.challengerId);
      if (challenge) {
        pendingChallenges.delete(payload.challengerId);
        send(challenge.from, 'BATTLE_DECLINE', { by: ws.trainerName });
      }
      break;
    }

    // ── Submit a battle action ──────────────────────────────────────────────
    case 'BATTLE_ACTION': {
      if (!ws.roomId) {
        send(ws, 'ERROR', { message: 'You are not in a battle' });
        return;
      }

      const room = activeRooms.get(ws.roomId);
      if (!room || room.state !== 'active') return;
      if (room.turn !== ws.playerId) {
        send(ws, 'ERROR', { message: 'It is not your turn' });
        return;
      }

      const opponent =
        room.player1.playerId === ws.playerId ? room.player2 : room.player1;

      // Relay the action opaquely to the opponent
      send(opponent, 'BATTLE_ACTION', { from: ws.playerId, action: payload });

      // Advance turn
      room.turn = opponent.playerId;
      const newState = { roomId: room.id, turn: room.turn };
      send(room.player1, 'BATTLE_STATE', newState);
      send(room.player2, 'BATTLE_STATE', newState);
      break;
    }

    // ── End the battle ──────────────────────────────────────────────────────
    case 'BATTLE_END': {
      if (!ws.roomId) return;
      endBattleRoom(
        ws.roomId,
        payload?.winner ?? null,
        payload?.reason ?? 'normal',
      );
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
  pendingChallenges.delete(ws.playerId);

  if (ws.roomId) {
    const room = activeRooms.get(ws.roomId);
    if (room) {
      const opponent =
        room.player1.playerId === ws.playerId ? room.player2 : room.player1;
      endBattleRoom(ws.roomId, opponent.playerId, 'opponent_disconnected');
    }
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

/**
 * Terminates a battle room: marks it as ended, notifies both players,
 * clears their `roomId`, and removes the room from the map.
 *
 * @param roomId - ID of the room to end.
 * @param winner - `playerId` of the winner, or `null` for a draw/abort.
 * @param reason - Human-readable reason string forwarded to clients.
 * @internal
 */
function endBattleRoom(
  roomId: string,
  winner: string | null,
  reason: string,
): void {
  const room = activeRooms.get(roomId);
  if (!room) return;

  room.state = 'ended';
  const result = { winner, reason };
  send(room.player1, 'BATTLE_END', result);
  send(room.player2, 'BATTLE_END', result);

  room.player1.roomId = undefined;
  room.player2.roomId = undefined;
  activeRooms.delete(roomId);
}
