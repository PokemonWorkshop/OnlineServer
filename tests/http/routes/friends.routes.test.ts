/**
 * Tests for src/http/routes/friends.routes.ts
 *
 * Covers:
 * - GET    /api/v1/friends
 * - POST   /api/v1/friends/heartbeat
 * - POST   /api/v1/friends/request/:friendCode
 * - POST   /api/v1/friends/accept/:friendCode
 * - POST   /api/v1/friends/decline/:friendCode
 * - DELETE /api/v1/friends/:friendCode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Router } from '../../../src/http/router';
import { registerFriendRoutes } from '../../../src/http/routes/friends.routes';

// ── Mock FriendService ────────────────────────────────────────────────────────

const mockGetList       = vi.fn();
const mockHeartbeat     = vi.fn();
const mockSendRequest   = vi.fn();
const mockAcceptRequest = vi.fn();
const mockDeclineRequest = vi.fn();
const mockRemoveFriend  = vi.fn();

vi.mock('../../../src/services/FriendService', () => ({
  friendService: {
    getList:        (...a: any[]) => mockGetList(...a),
    heartbeat:      (...a: any[]) => mockHeartbeat(...a),
    sendRequest:    (...a: any[]) => mockSendRequest(...a),
    acceptRequest:  (...a: any[]) => mockAcceptRequest(...a),
    declineRequest: (...a: any[]) => mockDeclineRequest(...a),
    removeFriend:   (...a: any[]) => mockRemoveFriend(...a),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAYER_ID = 'player-xyz';

function makeReq(method: string, url: string): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method  = method;
  req.url     = url;
  req.headers = { 'x-player-id': PLAYER_ID };
  process.nextTick(() => req.emit('end'));
  return req;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body:       '',
    headers:    {} as Record<string, string | number>,
    setHeader:  vi.fn((k: string, v: string | number) => { res.headers[k] = v; }),
    writeHead:  vi.fn((s: number, h?: Record<string, string | number>) => {
      res.statusCode = s;
      if (h) Object.assign(res.headers, h);
    }),
    end: vi.fn((b?: string) => { res.body = b ?? ''; }),
  } as unknown as ServerResponse & {
    statusCode: number;
    body: string;
    headers: Record<string, string | number>;
  };
  return res;
}

async function call(req: IncomingMessage) {
  const router = new Router();
  registerFriendRoutes(router);
  const res = makeRes();
  await router.handle(req, res);
  return { res, data: JSON.parse(res.body || 'null') };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/friends', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the friends list with 200', async () => {
    const list = { friends: [], pendingRequests: [] };
    mockGetList.mockResolvedValue(list);
    const { res, data } = await call(makeReq('GET', '/api/v1/friends'));
    expect(res.statusCode).toBe(200);
    expect(data).toEqual(list);
  });

  it('returns 404 when player is not registered', async () => {
    mockGetList.mockResolvedValue(null);
    const { res, data } = await call(makeReq('GET', '/api/v1/friends'));
    expect(res.statusCode).toBe(404);
    expect(data.error).toContain('not registered');
  });
});

describe('POST /api/v1/friends/heartbeat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls heartbeat and returns 200', async () => {
    mockHeartbeat.mockResolvedValue(undefined);
    const { res, data } = await call(makeReq('POST', '/api/v1/friends/heartbeat'));
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockHeartbeat).toHaveBeenCalledWith(PLAYER_ID);
  });
});

describe('POST /api/v1/friends/request/:friendCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a friend request and returns 200', async () => {
    mockSendRequest.mockResolvedValue({ ok: true });
    const { res, data } = await call(makeReq('POST', '/api/v1/friends/request/87654321'));
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockSendRequest).toHaveBeenCalledWith(PLAYER_ID, '87654321');
  });

  it('returns 400 when service fails (e.g. already friends)', async () => {
    mockSendRequest.mockResolvedValue({ ok: false, error: 'This player is already your friend' });
    const { res, data } = await call(makeReq('POST', '/api/v1/friends/request/87654321'));
    expect(res.statusCode).toBe(400);
    expect(data.ok).toBe(false);
  });

  it('returns 400 when adding yourself', async () => {
    mockSendRequest.mockResolvedValue({ ok: false, error: 'Cannot add yourself' });
    const { res, data } = await call(makeReq('POST', '/api/v1/friends/request/12345678'));
    expect(res.statusCode).toBe(400);
    expect(data.error).toContain('yourself');
  });
});

describe('POST /api/v1/friends/accept/:friendCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a friend request and returns 200', async () => {
    mockAcceptRequest.mockResolvedValue({ ok: true });
    const { res, data } = await call(makeReq('POST', '/api/v1/friends/accept/11111111'));
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockAcceptRequest).toHaveBeenCalledWith(PLAYER_ID, '11111111');
  });

  it('returns 400 when there is no pending request from that friend', async () => {
    mockAcceptRequest.mockResolvedValue({ ok: false, error: 'No request from this friend' });
    const { res } = await call(makeReq('POST', '/api/v1/friends/accept/11111111'));
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/friends/decline/:friendCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('declines a friend request and returns 200', async () => {
    mockDeclineRequest.mockResolvedValue({ ok: true });
    const { res, data } = await call(makeReq('POST', '/api/v1/friends/decline/22222222'));
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockDeclineRequest).toHaveBeenCalledWith(PLAYER_ID, '22222222');
  });
});

describe('DELETE /api/v1/friends/:friendCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes a friend and returns 200', async () => {
    mockRemoveFriend.mockResolvedValue({ ok: true });
    const { res, data } = await call(makeReq('DELETE', '/api/v1/friends/33333333'));
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockRemoveFriend).toHaveBeenCalledWith(PLAYER_ID, '33333333');
  });

  it('returns 400 when the friend is not found', async () => {
    mockRemoveFriend.mockResolvedValue({ ok: false, error: 'Player not found' });
    const { res } = await call(makeReq('DELETE', '/api/v1/friends/33333333'));
    expect(res.statusCode).toBe(400);
  });
});
