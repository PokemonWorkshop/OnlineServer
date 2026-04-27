/**
 * Tests for src/ws/BaseRoom.ts and src/ws/types.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import { BaseRoom, PendingRequest } from '../../src/ws/BaseRoom';
import { AuthenticatedWs, send } from '../../src/ws/types';

class TestRoom extends BaseRoom {
  static readonly rooms = new Map<string, TestRoom>();

  constructor(p1: AuthenticatedWs, p2: AuthenticatedWs) {
    super(p1, p2, 'test');
    TestRoom.rooms.set(this.id, this);
  }

  override close(): void {
    TestRoom.rooms.delete(this.id);
    super.close();
  }
}

function makeWs(playerId: string, trainerName = 'Trainer'): AuthenticatedWs {
  const ws = {
    playerId,
    trainerName,
    roomId:    undefined as string | undefined,
    readyState: WebSocket.OPEN,
    send:      vi.fn(),
  } as unknown as AuthenticatedWs;
  return ws;
}

describe('BaseRoom', () => {
  let ws1: AuthenticatedWs;
  let ws2: AuthenticatedWs;
  let room: TestRoom;

  beforeEach(() => {
    TestRoom.rooms.clear();
    ws1  = makeWs('p1', 'Ash');
    ws2  = makeWs('p2', 'Misty');
    room = new TestRoom(ws1, ws2);
  });

  it('generates a unique ID with the correct prefix', () => {
    expect(room.id).toMatch(/^test_/);
  });

  it('assigns roomId to both sockets on construction', () => {
    expect(ws1.roomId).toBe(room.id);
    expect(ws2.roomId).toBe(room.id);
  });

  it('starts in the active state', () => {
    expect(room.isActive).toBe(true);
    expect(room.state).toBe('active');
  });

  it('opponentOf returns player2 when given player1', () => {
    expect(room.opponentOf(ws1)).toBe(ws2);
  });

  it('opponentOf returns player1 when given player2', () => {
    expect(room.opponentOf(ws2)).toBe(ws1);
  });

  it('opponentOf returns undefined for a stranger', () => {
    const stranger = makeWs('p3');
    expect(room.opponentOf(stranger)).toBeUndefined();
  });

  it('includes returns true for both players', () => {
    expect(room.includes(ws1)).toBe(true);
    expect(room.includes(ws2)).toBe(true);
  });

  it('includes returns false for a stranger', () => {
    expect(room.includes(makeWs('p3'))).toBe(false);
  });

  it('broadcast sends a message to both players', () => {
    room.broadcast('PING');
    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).toHaveBeenCalledOnce();
  });

  it('sendTo sends to a specific player only', () => {
    room.sendTo(ws1, 'PING');
    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).not.toHaveBeenCalled();
  });

  it('sendToOpponent sends to the opponent only', () => {
    room.sendToOpponent(ws1, 'PING');
    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalledOnce();
  });

  it('sendToOpponent is a no-op when the sender is not in the room', () => {
    const stranger = makeWs('p3');
    room.sendToOpponent(stranger, 'PING');
    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).not.toHaveBeenCalled();
  });

  it('broadcast includes the correct JSON payload', () => {
    room.broadcast('PONG', { extra: 'data' });
    const msg = JSON.parse((ws1.send as any).mock.calls[0][0]);
    expect(msg.type).toBe('PONG');
    expect(msg.payload).toEqual({ extra: 'data' });
  });

  it('close() sets state to ended', () => {
    room.close();
    expect(room.isActive).toBe(false);
    expect(room.state).toBe('ended');
  });

  it('close() clears roomId on both sockets', () => {
    room.close();
    expect(ws1.roomId).toBeUndefined();
    expect(ws2.roomId).toBeUndefined();
  });

  it('subclass close() removes the room from its registry', () => {
    expect(TestRoom.rooms.has(room.id)).toBe(true);
    room.close();
    expect(TestRoom.rooms.has(room.id)).toBe(false);
  });

  it('generateId creates unique IDs across multiple calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => BaseRoom.generateId('test')));
    expect(ids.size).toBe(100);
  });
});

describe('send() helper', () => {
  it('sends JSON when the socket is OPEN', () => {
    const ws = makeWs('p1');
    send(ws, 'PONG');
    expect(ws.send).toHaveBeenCalledOnce();
    const msg = JSON.parse((ws.send as any).mock.calls[0][0]);
    expect(msg.type).toBe('PONG');
  });

  it('includes the payload in the envelope', () => {
    const ws = makeWs('p1');
    send(ws, 'ERROR', { message: 'oops' });
    const msg = JSON.parse((ws.send as any).mock.calls[0][0]);
    expect(msg.payload).toEqual({ message: 'oops' });
  });

  it('silently drops the message when the socket is CLOSING', () => {
    const ws = makeWs('p1');
    (ws as any).readyState = WebSocket.CLOSING;
    send(ws, 'PONG');
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('silently drops the message when the socket is CLOSED', () => {
    const ws = makeWs('p1');
    (ws as any).readyState = WebSocket.CLOSED;
    send(ws, 'PONG');
    expect(ws.send).not.toHaveBeenCalled();
  });
});
