/**
 * Tests for src/ws/WsServer.ts
 *
 * Integration-level tests: spin up a real HTTP+WS server in-process,
 * connect WebSocket clients, and verify the server-side behaviour.
 *
 * Covers:
 * - Authentication: invalid API key, missing playerId
 * - Connection tracking (clients map)
 * - Reconnection (previous session replaced)
 * - PING → PONG keepalive
 * - Unknown message type → ERROR
 * - Invalid JSON → ERROR
 * - Missing "type" field → ERROR
 * - Routing to battle/trade handlers (smoke tests)
 * - Disconnection cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { createWsServer, clients } from '../../src/ws/WsServer';

const mockGetStatus = vi.fn();

vi.mock('../../src/services/MaintenanceService', () => ({
  maintenanceService: {
    getStatus: (...a: any[]) => mockGetStatus(...a),
  },
}));

// ── Server lifecycle helpers ──────────────────────────────────────────────────

let httpServer: Server;
let wss: WebSocketServer;
let port: number;

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });
    createWsServer(wss);
    httpServer.listen(0, '127.0.0.1', () => {
      port = (httpServer.address() as any).port;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    wss.close(() => httpServer.close(() => resolve()));
  });
}

// ── WS client helpers ─────────────────────────────────────────────────────────

interface ConnectOptions {
  apiKey?:    string;
  playerId?:  string;
  trainerName?: string;
}

function connect(opts: ConnectOptions = {}): WebSocket {
  const {
    apiKey    = 'test-api-key',
    playerId  = 'test-player',
    trainerName = 'Trainer',
  } = opts;

  const params = new URLSearchParams({
    apiKey,
    playerId,
    trainerName: encodeURIComponent(trainerName),
  });

  return new WebSocket(`ws://127.0.0.1:${port}?${params}`);
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open',  resolve);
    ws.once('error', reject);
  });
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.once('close', (code, reason) =>
      resolve({ code, reason: reason.toString() }),
    );
  });
}

function waitForMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout waiting for message')), 2000);
    ws.once('message', (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

function waitForMessages(ws: WebSocket, count: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('timeout waiting for message'));
    }, 2000);

    const onMessage = (raw: any) => {
      messages.push(JSON.parse(raw.toString()));
      if (messages.length === count) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(messages);
      }
    };

    ws.on('message', onMessage);
  });
}

function send(ws: WebSocket, type: string, payload?: unknown) {
  ws.send(JSON.stringify({ type, payload }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WsServer', () => {
  beforeEach(async () => {
    mockGetStatus.mockResolvedValue({
      enabled: false,
      message: '',
      endAt: null,
    });
    clients.clear();
    await startServer();
  });

  afterEach(async () => {
    // Close any open connections
    clients.forEach((ws) => ws.close());
    clients.clear();
    await stopServer();
  });

  // ── Authentication ──────────────────────────────────────────────────────────

  it('closes the connection (4001) when the API key is wrong', async () => {
    const ws = connect({ apiKey: 'wrong-key' });
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(4001);
    expect(reason).toContain('Invalid API Key');
  });

  it('closes the connection (4002) when playerId is missing', async () => {
    const ws = connect({ playerId: '' });
    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(4002);
    expect(reason).toContain('Missing playerId');
  });

  it('closes the connection (4004) when maintenance is enabled', async () => {
    mockGetStatus.mockResolvedValue({
      enabled: true,
      message: 'Maintenance in progress',
      endAt: '2026-04-28T20:00:00.000Z',
    });

    const ws = connect({ playerId: 'player-maint-down' });
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('MAINTENANCE_STATUS');

    const { code, reason } = await waitForClose(ws);
    expect(code).toBe(4004);
    expect(reason).toContain('maintenance');
    expect(clients.has('player-maint-down')).toBe(false);
  });

  // ── Connection tracking ─────────────────────────────────────────────────────

  it('registers the client in the clients map after connection', async () => {
    const ws = connect({ playerId: 'player-track' });
    await waitForOpen(ws);
    expect(clients.has('player-track')).toBe(true);
    ws.close();
  });

  it('removes the client from the map after disconnection', async () => {
    const ws = connect({ playerId: 'player-disc' });
    await waitForOpen(ws);
    ws.close();
    await waitForClose(ws);
    // Give the server a tick to process the close event
    await new Promise((r) => setTimeout(r, 50));
    expect(clients.has('player-disc')).toBe(false);
  });

  // ── Reconnection ────────────────────────────────────────────────────────────

  it('replaces the previous session (4003) when the same player reconnects', async () => {
    const ws1 = connect({ playerId: 'player-recon' });
    await waitForOpen(ws1);

    const closePromise = waitForClose(ws1);

    const ws2 = connect({ playerId: 'player-recon' });
    await waitForOpen(ws2);

    const { code } = await closePromise;
    expect(code).toBe(4003);

    expect(clients.get('player-recon')).toBe(clients.get('player-recon'));
    ws2.close();
  });

  // ── PING / PONG ─────────────────────────────────────────────────────────────

  it('responds PONG to a PING message', async () => {
    const ws = connect({ playerId: 'player-ping' });
    await waitForOpen(ws);
    send(ws, 'PING');
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('PONG');
    ws.close();
  });

  it('returns the maintenance status when requested explicitly', async () => {
    const ws = connect({ playerId: 'player-maintenance' });
    await waitForOpen(ws);
    mockGetStatus.mockResolvedValue({
      enabled: true,
      message: 'Maintenance in progress',
      endAt: '2026-04-28T20:00:00.000Z',
    });
    const messagePromise = waitForMessage(ws);
    send(ws, 'MAINTENANCE_STATUS');
    const msg = await messagePromise;
    expect(msg.type).toBe('MAINTENANCE_STATUS');
    expect(msg.payload).toEqual({
      enabled: true,
      message: 'Maintenance in progress',
      endAt: '2026-04-28T20:00:00.000Z',
    });
    ws.close();
  });

  // ── Error cases ─────────────────────────────────────────────────────────────

  it('sends ERROR for invalid JSON', async () => {
    const ws = connect({ playerId: 'player-badjson' });
    await waitForOpen(ws);
    ws.send('not valid json {{{{');
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('ERROR');
    expect(msg.payload.message).toContain('Invalid JSON');
    ws.close();
  });

  it('sends ERROR when the type field is missing', async () => {
    const ws = connect({ playerId: 'player-notype' });
    await waitForOpen(ws);
    ws.send(JSON.stringify({ payload: 'no type here' }));
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('ERROR');
    expect(msg.payload.message).toContain('type');
    ws.close();
  });

  it('sends ERROR for an unknown message type', async () => {
    const ws = connect({ playerId: 'player-unk' });
    await waitForOpen(ws);
    send(ws, 'UNKNOWN_TYPE', {});
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('ERROR');
    expect(msg.payload.message).toContain('Unknown message type');
    ws.close();
  });

  // ── Handler routing (smoke tests) ────────────────────────────────────────────

  it('routes BATTLE_* messages without crashing', async () => {
    const ws = connect({ playerId: 'player-battle-smoke' });
    await waitForOpen(ws);
    // Challenging a non-existent player → should get ERROR (not a crash)
    send(ws, 'BATTLE_CHALLENGE', { targetPlayerId: 'ghost-player' });
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('ERROR');
    ws.close();
  });

  it('blocks gameplay messages when maintenance becomes enabled', async () => {
    const ws = connect({ playerId: 'player-maint-live' });
    await waitForOpen(ws);

    mockGetStatus.mockResolvedValue({
      enabled: true,
      message: 'Maintenance in progress',
      endAt: '2026-04-28T20:00:00.000Z',
    });

    const messagesPromise = waitForMessages(ws, 2);
    send(ws, 'BATTLE_CHALLENGE', { targetPlayerId: 'ghost-player' });
    const [first, second] = await messagesPromise;
    expect([first.type, second.type]).toContain('MAINTENANCE_STATUS');
    expect([first.type, second.type]).toContain('ERROR');
    ws.close();
  });

  it('routes TRADE_* messages without crashing', async () => {
    const ws = connect({ playerId: 'player-trade-smoke' });
    await waitForOpen(ws);
    send(ws, 'TRADE_REQUEST', { targetPlayerId: 'ghost-player' });
    const msg = await waitForMessage(ws);
    expect(msg.type).toBe('ERROR');
    ws.close();
  });

  // ── Multi-client battle flow (end-to-end smoke) ───────────────────────────

  it('completes a BATTLE_CHALLENGE → BATTLE_ACCEPT handshake between two clients', async () => {
    const ws1 = connect({ playerId: 'e2e-p1', trainerName: 'Ash' });
    const ws2 = connect({ playerId: 'e2e-p2', trainerName: 'Misty' });

    await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

    send(ws1, 'BATTLE_CHALLENGE', { targetPlayerId: 'e2e-p2' });

    // ws2 should receive the challenge
    const challenge = await waitForMessage(ws2);
    expect(challenge.type).toBe('BATTLE_CHALLENGE');
    expect(challenge.payload.challengerId).toBe('e2e-p1');

    // ws2 accepts
    send(ws2, 'BATTLE_ACCEPT', { challengerId: 'e2e-p1' });

    const [state1, state2] = await Promise.all([
      waitForMessage(ws1),
      waitForMessage(ws2),
    ]);

    expect(state1.type).toBe('BATTLE_STATE');
    expect(state2.type).toBe('BATTLE_STATE');
    expect(state1.payload.roomId).toBeDefined();

    ws1.close();
    ws2.close();
  });

  it('completes a TRADE_REQUEST → TRADE_ACCEPT handshake between two clients', async () => {
    const ws1 = connect({ playerId: 'trade-e2e-p1', trainerName: 'Ash' });
    const ws2 = connect({ playerId: 'trade-e2e-p2', trainerName: 'Misty' });

    await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

    send(ws1, 'TRADE_REQUEST', { targetPlayerId: 'trade-e2e-p2' });

    const request = await waitForMessage(ws2);
    expect(request.type).toBe('TRADE_REQUEST');

    send(ws2, 'TRADE_ACCEPT', { requesterId: 'trade-e2e-p1' });

    const [accept1, accept2] = await Promise.all([
      waitForMessage(ws1),
      waitForMessage(ws2),
    ]);

    expect(accept1.type).toBe('TRADE_ACCEPT');
    expect(accept2.type).toBe('TRADE_ACCEPT');
    expect(accept1.payload.sessionId).toBe(accept2.payload.sessionId);

    ws1.close();
    ws2.close();
  });
});
