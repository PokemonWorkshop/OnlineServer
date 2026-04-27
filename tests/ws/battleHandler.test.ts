/**
 * Tests for src/ws/handlers/battleHandler.ts
 *
 * Covers:
 * - BATTLE_CHALLENGE  (happy path + errors: offline target, already in battle, pending exists)
 * - BATTLE_ACCEPT     (happy path + errors: no challenge, wrong recipient, already in room)
 * - BATTLE_DECLINE    (happy path + no-op when challenge not found)
 * - BATTLE_ACTION     (happy path + errors: not in battle, wrong turn)
 * - BATTLE_END        (terminates room)
 * - cleanupBattle     (disconnect removes pending + ends active battle)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { handleBattleMessage, cleanupBattle } from '../../src/ws/handlers/battleHandler';
import { AuthenticatedWs } from '../../src/ws/types';

// ── Mock WS factory ───────────────────────────────────────────────────────────

function makeWs(playerId: string, trainerName = 'Trainer'): AuthenticatedWs {
  return {
    playerId,
    trainerName,
    roomId:    undefined as string | undefined,
    readyState: WebSocket.OPEN,
    send:      vi.fn(),
  } as unknown as AuthenticatedWs;
}

function parseMsg(ws: AuthenticatedWs, callIndex = 0) {
  return JSON.parse((ws.send as any).mock.calls[callIndex][0]);
}

function lastMsg(ws: AuthenticatedWs) {
  const calls = (ws.send as any).mock.calls;
  return JSON.parse(calls[calls.length - 1][0]);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dispatch(
  ws: AuthenticatedWs,
  type: string,
  payload: unknown,
  clients: Map<string, AuthenticatedWs>,
) {
  handleBattleMessage(ws, type, payload, clients);
}

// ── Global cleanup — flush static BattleRoom maps before every test ───────────
// BattleRoom.activeRooms and BattleRoom.pendingChallenges are static Maps that
// survive across describe blocks.  Calling cleanupBattle on every player ID used
// in the suite resets them to a clean state before each test.

beforeEach(() => {
  for (const id of ['p1', 'p2', 'p3', 'e2e-p1', 'e2e-p2']) {
    const ghost = makeWs(id);
    cleanupBattle(ghost);
  }
});

// ── BATTLE_CHALLENGE ──────────────────────────────────────────────────────────

describe('BATTLE_CHALLENGE', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
  });

  it('forwards the challenge to the target player', () => {
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    const msg = parseMsg(ws2);
    expect(msg.type).toBe('BATTLE_CHALLENGE');
    expect(msg.payload.challengerId).toBe('p1');
    expect(msg.payload.challengerName).toBe('Ash');
  });

  it('sends ERROR when target is offline', () => {
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p99' }, clients);
    expect(parseMsg(ws1).type).toBe('ERROR');
  });

  it('sends ERROR when challenger is already in a room', () => {
    ws1.roomId = 'battle_existing';
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    expect(parseMsg(ws1).type).toBe('ERROR');
    expect(parseMsg(ws1).payload.message).toContain('already in a battle');
  });

  it('sends ERROR when a challenge from this player is already pending', () => {
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    vi.clearAllMocks();
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    expect(parseMsg(ws1).type).toBe('ERROR');
    expect(parseMsg(ws1).payload.message).toContain('already pending');
  });
});

// ── BATTLE_ACCEPT ─────────────────────────────────────────────────────────────

describe('BATTLE_ACCEPT', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
    // Challenger sends request first
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    vi.clearAllMocks();
  });

  it('creates a room and broadcasts BATTLE_STATE to both players', () => {
    dispatch(ws2, 'BATTLE_ACCEPT', { challengerId: 'p1' }, clients);
    const msg1 = parseMsg(ws1);
    const msg2 = parseMsg(ws2);
    expect(msg1.type).toBe('BATTLE_STATE');
    expect(msg2.type).toBe('BATTLE_STATE');
    expect(msg1.payload.roomId).toBeDefined();
    expect(msg1.payload.turn).toBeDefined();
  });

  it('assigns roomId to both sockets', () => {
    dispatch(ws2, 'BATTLE_ACCEPT', { challengerId: 'p1' }, clients);
    expect(ws1.roomId).toBeDefined();
    expect(ws2.roomId).toBeDefined();
    expect(ws1.roomId).toBe(ws2.roomId);
  });

  it('sends ERROR when there is no pending challenge from the player', () => {
    dispatch(ws2, 'BATTLE_ACCEPT', { challengerId: 'p99' }, clients);
    expect(parseMsg(ws2).type).toBe('ERROR');
  });

  it('sends ERROR when the wrong player accepts (not the intended recipient)', () => {
    const ws3 = makeWs('p3');
    clients.set('p3', ws3);
    dispatch(ws3, 'BATTLE_ACCEPT', { challengerId: 'p1' }, clients);
    expect(parseMsg(ws3).type).toBe('ERROR');
  });

  it('sends ERROR when the accepting player is already in a room', () => {
    ws2.roomId = 'battle_existing';
    dispatch(ws2, 'BATTLE_ACCEPT', { challengerId: 'p1' }, clients);
    expect(parseMsg(ws2).type).toBe('ERROR');
  });
});

// ── BATTLE_DECLINE ────────────────────────────────────────────────────────────

describe('BATTLE_DECLINE', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    vi.clearAllMocks();
  });

  it('notifies the challenger when declined', () => {
    dispatch(ws2, 'BATTLE_DECLINE', { challengerId: 'p1' }, clients);
    const msg = parseMsg(ws1);
    expect(msg.type).toBe('BATTLE_DECLINE');
    expect(msg.payload.by).toBe('Misty');
  });

  it('is a no-op when the challenge does not exist', () => {
    dispatch(ws2, 'BATTLE_DECLINE', { challengerId: 'nobody' }, clients);
    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).not.toHaveBeenCalled();
  });
});

// ── BATTLE_ACTION ─────────────────────────────────────────────────────────────

describe('BATTLE_ACTION', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    dispatch(ws2, 'BATTLE_ACCEPT', { challengerId: 'p1' }, clients);
    vi.clearAllMocks();
  });

  it('relays the action to the opponent and advances the turn', () => {
    // p1 goes first (player1 is the challenger)
    dispatch(ws1, 'BATTLE_ACTION', { move: 'tackle' }, clients);

    // ws2 should receive the BATTLE_ACTION relay
    const actionMsg = (ws2.send as any).mock.calls.find((c: any) => {
      const m = JSON.parse(c[0]); return m.type === 'BATTLE_ACTION';
    });
    expect(actionMsg).toBeDefined();

    // Both should receive BATTLE_STATE with updated turn
    const stateMsg = (ws1.send as any).mock.calls.find((c: any) => {
      const m = JSON.parse(c[0]); return m.type === 'BATTLE_STATE';
    });
    expect(stateMsg).toBeDefined();
    expect(JSON.parse(stateMsg[0]).payload.turn).toBe('p2');
  });

  it('sends ERROR when the player is not in a battle', () => {
    const stranger = makeWs('p3');
    clients.set('p3', stranger);
    dispatch(stranger, 'BATTLE_ACTION', { move: 'tackle' }, clients);
    expect(parseMsg(stranger).type).toBe('ERROR');
    expect(parseMsg(stranger).payload.message).toContain('not in a battle');
  });

  it("sends ERROR when it is not the player's turn", () => {
    // p2 tries to go when it is p1's turn
    dispatch(ws2, 'BATTLE_ACTION', { move: 'splash' }, clients);
    expect(parseMsg(ws2).type).toBe('ERROR');
    expect(parseMsg(ws2).payload.message).toContain('not your turn');
  });
});

// ── BATTLE_END ────────────────────────────────────────────────────────────────

describe('BATTLE_END', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    dispatch(ws2, 'BATTLE_ACCEPT', { challengerId: 'p1' }, clients);
    vi.clearAllMocks();
  });

  it('broadcasts BATTLE_END to both players and clears roomIds', () => {
    dispatch(ws1, 'BATTLE_END', { winner: 'p1', reason: 'normal' }, clients);
    const msg1 = lastMsg(ws1);
    const msg2 = lastMsg(ws2);
    expect(msg1.type).toBe('BATTLE_END');
    expect(msg2.type).toBe('BATTLE_END');
    expect(msg1.payload.winner).toBe('p1');
    expect(ws1.roomId).toBeUndefined();
    expect(ws2.roomId).toBeUndefined();
  });

  it('is a no-op when the player is not in a room', () => {
    const stranger = makeWs('p3');
    dispatch(stranger, 'BATTLE_END', { winner: 'p3' }, clients);
    // Should not throw
    expect(ws1.send).not.toHaveBeenCalled();
  });
});

// ── cleanupBattle ─────────────────────────────────────────────────────────────

describe('cleanupBattle', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
  });

  it('removes a pending challenge when the challenger disconnects', () => {
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    vi.clearAllMocks();
    cleanupBattle(ws1);
    // Challenge should be gone — if p1 challenges again it should not get "already pending"
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    expect(parseMsg(ws2).type).toBe('BATTLE_CHALLENGE'); // forwarded, not an ERROR
  });

  it('ends the active battle and notifies the opponent when a player disconnects', () => {
    dispatch(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'p2' }, clients);
    dispatch(ws2, 'BATTLE_ACCEPT', { challengerId: 'p1' }, clients);
    vi.clearAllMocks();

    cleanupBattle(ws1);

    // ws2 should receive BATTLE_END with reason 'opponent_disconnected'
    const msg = lastMsg(ws2);
    expect(msg.type).toBe('BATTLE_END');
    expect(msg.payload.reason).toBe('opponent_disconnected');
    expect(msg.payload.winner).toBe('p2');
  });
});
