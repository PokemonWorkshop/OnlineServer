/**
 * Tests for src/ws/handlers/tradeHandler.ts
 *
 * Covers:
 * - TRADE_REQUEST  (happy path + errors: offline target, already in trade)
 * - TRADE_ACCEPT   (happy path + errors: no request, wrong recipient, already in room)
 * - TRADE_DECLINE  (happy path + no-op)
 * - TRADE_OFFER    (happy path, resets confirmations)
 * - TRADE_CONFIRM  (single confirm, double confirm → complete)
 * - TRADE_CANCEL   (aborts session)
 * - cleanupTrade   (disconnect during session notifies opponent)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { handleTradeMessage, cleanupTrade } from '../../src/ws/handlers/tradeHandler';
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

function dispatch(
  ws: AuthenticatedWs,
  type: string,
  payload: unknown,
  clients: Map<string, AuthenticatedWs>,
) {
  handleTradeMessage(ws, type, payload, clients);
}

// ── Shared setup helpers ───────────────────────────────────────────────────────

function setupTrade() {
  const ws1 = makeWs('p1', 'Ash');
  const ws2 = makeWs('p2', 'Misty');
  const clients = new Map<string, AuthenticatedWs>([['p1', ws1], ['p2', ws2]]);

  dispatch(ws1, 'TRADE_REQUEST', { targetPlayerId: 'p2' }, clients);
  dispatch(ws2, 'TRADE_ACCEPT',  { requesterId: 'p1' },   clients);
  vi.clearAllMocks();

  return { ws1, ws2, clients };
}

// ── TRADE_REQUEST ─────────────────────────────────────────────────────────────

describe('TRADE_REQUEST', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
  });

  it('forwards the request to the target player', () => {
    dispatch(ws1, 'TRADE_REQUEST', { targetPlayerId: 'p2' }, clients);
    const msg = parseMsg(ws2);
    expect(msg.type).toBe('TRADE_REQUEST');
    expect(msg.payload.requesterId).toBe('p1');
    expect(msg.payload.requesterName).toBe('Ash');
  });

  it('sends ERROR when target is offline', () => {
    dispatch(ws1, 'TRADE_REQUEST', { targetPlayerId: 'ghost' }, clients);
    expect(parseMsg(ws1).type).toBe('ERROR');
    expect(parseMsg(ws1).payload.message).toContain('not found');
  });

  it('sends ERROR when sender is already in a trade', () => {
    ws1.roomId = 'trade_existing';
    dispatch(ws1, 'TRADE_REQUEST', { targetPlayerId: 'p2' }, clients);
    expect(parseMsg(ws1).type).toBe('ERROR');
    expect(parseMsg(ws1).payload.message).toContain('already in a trade');
  });
});

// ── TRADE_ACCEPT ──────────────────────────────────────────────────────────────

describe('TRADE_ACCEPT', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
    dispatch(ws1, 'TRADE_REQUEST', { targetPlayerId: 'p2' }, clients);
    vi.clearAllMocks();
  });

  it('creates a session and sends TRADE_ACCEPT to both players', () => {
    dispatch(ws2, 'TRADE_ACCEPT', { requesterId: 'p1' }, clients);
    const msg1 = parseMsg(ws1);
    const msg2 = parseMsg(ws2);
    expect(msg1.type).toBe('TRADE_ACCEPT');
    expect(msg2.type).toBe('TRADE_ACCEPT');
    expect(msg1.payload.sessionId).toBeDefined();
    expect(msg1.payload.sessionId).toBe(msg2.payload.sessionId);
  });

  it('assigns roomId to both sockets', () => {
    dispatch(ws2, 'TRADE_ACCEPT', { requesterId: 'p1' }, clients);
    expect(ws1.roomId).toBeDefined();
    expect(ws2.roomId).toBeDefined();
  });

  it('sends ERROR when no pending request exists for that requester', () => {
    dispatch(ws2, 'TRADE_ACCEPT', { requesterId: 'p99' }, clients);
    expect(parseMsg(ws2).type).toBe('ERROR');
  });

  it('sends ERROR when the wrong player accepts', () => {
    const ws3 = makeWs('p3');
    clients.set('p3', ws3);
    dispatch(ws3, 'TRADE_ACCEPT', { requesterId: 'p1' }, clients);
    expect(parseMsg(ws3).type).toBe('ERROR');
  });

  it('sends ERROR when the accepting player is already in a room', () => {
    ws2.roomId = 'trade_existing';
    dispatch(ws2, 'TRADE_ACCEPT', { requesterId: 'p1' }, clients);
    expect(parseMsg(ws2).type).toBe('ERROR');
  });
});

// ── TRADE_DECLINE ─────────────────────────────────────────────────────────────

describe('TRADE_DECLINE', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let clients: Map<string, AuthenticatedWs>;

  beforeEach(() => {
    ws1 = makeWs('p1', 'Ash');
    ws2 = makeWs('p2', 'Misty');
    clients = new Map([['p1', ws1], ['p2', ws2]]);
    dispatch(ws1, 'TRADE_REQUEST', { targetPlayerId: 'p2' }, clients);
    vi.clearAllMocks();
  });

  it('notifies the requester when declined', () => {
    dispatch(ws2, 'TRADE_DECLINE', { requesterId: 'p1' }, clients);
    const msg = parseMsg(ws1);
    expect(msg.type).toBe('TRADE_DECLINE');
    expect(msg.payload.by).toBe('Misty');
  });

  it('is a no-op when the request does not exist', () => {
    dispatch(ws2, 'TRADE_DECLINE', { requesterId: 'nobody' }, clients);
    expect(ws1.send).not.toHaveBeenCalled();
  });
});

// ── TRADE_OFFER ───────────────────────────────────────────────────────────────

describe('TRADE_OFFER', () => {
  it('relays the offer to the opponent', () => {
    const { ws1, ws2, clients } = setupTrade();
    const creature = { speciesId: '001', level: 5 };
    dispatch(ws1, 'TRADE_OFFER', { creature }, clients);

    const msg = parseMsg(ws2);
    expect(msg.type).toBe('TRADE_OFFER');
    expect(msg.payload.creature).toEqual(creature);
    expect(msg.payload.from).toBe('p1');
  });

  it('sends ERROR when player is not in a trade', () => {
    const ws = makeWs('loner');
    const clients = new Map<string, AuthenticatedWs>([['loner', ws]]);
    dispatch(ws, 'TRADE_OFFER', { creature: {} }, clients);
    expect(parseMsg(ws).type).toBe('ERROR');
    expect(parseMsg(ws).payload.message).toContain('not in a trade');
  });
});

// ── TRADE_CONFIRM ─────────────────────────────────────────────────────────────

describe('TRADE_CONFIRM', () => {
  it('relays confirmation to the opponent when only one player confirms', () => {
    const { ws1, ws2, clients } = setupTrade();
    // Both players place offers first
    dispatch(ws1, 'TRADE_OFFER', { creature: { speciesId: '001' } }, clients);
    dispatch(ws2, 'TRADE_OFFER', { creature: { speciesId: '004' } }, clients);
    vi.clearAllMocks();

    dispatch(ws1, 'TRADE_CONFIRM', {}, clients);
    const msg = parseMsg(ws2);
    expect(msg.type).toBe('TRADE_CONFIRM');
    expect(ws1.roomId).toBeDefined(); // session not yet closed
  });

  it('completes the trade when both players confirm', () => {
    const { ws1, ws2, clients } = setupTrade();
    const creature1 = { speciesId: '001', level: 5 };
    const creature2 = { speciesId: '004', level: 5 };

    dispatch(ws1, 'TRADE_OFFER', { creature: creature1 }, clients);
    dispatch(ws2, 'TRADE_OFFER', { creature: creature2 }, clients);
    vi.clearAllMocks();

    dispatch(ws1, 'TRADE_CONFIRM', {}, clients);
    dispatch(ws2, 'TRADE_CONFIRM', {}, clients);

    // Each player receives TRADE_COMPLETE with the other's creature
    const msg1 = (ws1.send as any).mock.calls.find((c: any) => JSON.parse(c[0]).type === 'TRADE_COMPLETE');
    const msg2 = (ws2.send as any).mock.calls.find((c: any) => JSON.parse(c[0]).type === 'TRADE_COMPLETE');

    expect(msg1).toBeDefined();
    expect(msg2).toBeDefined();
    expect(JSON.parse(msg1[0]).payload.yourNewCreature).toEqual(creature2);
    expect(JSON.parse(msg2[0]).payload.yourNewCreature).toEqual(creature1);

    // Session should be closed
    expect(ws1.roomId).toBeUndefined();
    expect(ws2.roomId).toBeUndefined();
  });
});

// ── TRADE_CANCEL ──────────────────────────────────────────────────────────────

describe('TRADE_CANCEL', () => {
  it('notifies the opponent and closes the session', () => {
    const { ws1, ws2, clients } = setupTrade();
    dispatch(ws1, 'TRADE_CANCEL', {}, clients);

    const msg = parseMsg(ws2);
    expect(msg.type).toBe('TRADE_CANCEL');
    expect(msg.payload.by).toBe('Ash');
    expect(ws1.roomId).toBeUndefined();
    expect(ws2.roomId).toBeUndefined();
  });

  it('is a no-op when the player is not in a trade', () => {
    const ws = makeWs('loner');
    const clients = new Map<string, AuthenticatedWs>([['loner', ws]]);
    // Should not throw
    dispatch(ws, 'TRADE_CANCEL', {}, clients);
    expect(ws.send).not.toHaveBeenCalled();
  });
});

// ── cleanupTrade ──────────────────────────────────────────────────────────────

describe('cleanupTrade', () => {
  it('removes a pending request when the requester disconnects', () => {
    const ws1 = makeWs('p1', 'Ash');
    const ws2 = makeWs('p2', 'Misty');
    const clients = new Map<string, AuthenticatedWs>([['p1', ws1], ['p2', ws2]]);

    dispatch(ws1, 'TRADE_REQUEST', { targetPlayerId: 'p2' }, clients);
    vi.clearAllMocks();
    cleanupTrade(ws1);

    // ws1 should be able to send a new request without "already pending" error
    dispatch(ws1, 'TRADE_REQUEST', { targetPlayerId: 'p2' }, clients);
    expect(parseMsg(ws2).type).toBe('TRADE_REQUEST');
  });

  it('sends TRADE_CANCEL to the opponent when an active trade player disconnects', () => {
    const { ws1, ws2 } = setupTrade();
    cleanupTrade(ws1);

    const msg = lastMsg(ws2);
    expect(msg.type).toBe('TRADE_CANCEL');
    expect(msg.payload.reason).toBe('disconnected');
    expect(ws1.roomId).toBeUndefined();
    expect(ws2.roomId).toBeUndefined();
  });
});
