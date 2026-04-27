/**
 * Tests for src/http/routes/auth.routes.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Router } from '../../../src/http/router';
import { registerAuthRoutes } from '../../../src/http/routes/auth.routes';

const mockPlayerFindOne = vi.fn();
const mockPlayerCreate = vi.fn();
const mockPlayerFindByIdAndUpdate = vi.fn();
const mockPlayerFindOneAndUpdate = vi.fn();
const mockDeletePlayer = vi.fn();

vi.mock('../../../src/models/Players', () => ({
  Player: {
    findOne: (...a: any[]) => mockPlayerFindOne(...a),
    create: (...a: any[]) => mockPlayerCreate(...a),
    findByIdAndUpdate: (...a: any[]) => mockPlayerFindByIdAndUpdate(...a),
    findOneAndUpdate: (...a: any[]) => mockPlayerFindOneAndUpdate(...a),
  },
  playerExpiresAt: () => new Date(),
}));

vi.mock('../../../src/services/FriendService', () => ({
  FriendService: {
    createPlayerWithUniqueFriendCode: (...a: any[]) => mockPlayerCreate(...a),
  },
}));

vi.mock('../../../src/services/PlayerService', () => ({
  playerService: { deletePlayer: (...a: any[]) => mockDeletePlayer(...a) },
}));

const PLAYER_ID = 'ash-uuid';

function makeReq(
  method: string,
  url: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = { 'x-api-key': 'test-api-key', ...extraHeaders };
  const json = JSON.stringify(body ?? {});
  process.nextTick(() => {
    req.emit('data', Buffer.from(json));
    req.emit('end');
  });
  return req;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: '',
    headers: {} as Record<string, string | number>,
    setHeader: vi.fn((k: string, v: string | number) => {
      res.headers[k] = v;
    }),
    writeHead: vi.fn((s: number, h?: Record<string, string | number>) => {
      res.statusCode = s;
      if (h) Object.assign(res.headers, h);
    }),
    end: vi.fn((b?: string) => {
      res.body = b ?? '';
    }),
  } as unknown as ServerResponse & {
    statusCode: number;
    body: string;
    headers: Record<string, string | number>;
  };
  return res;
}

async function call(req: IncomingMessage) {
  const router = new Router();
  registerAuthRoutes(router);
  const res = makeRes();
  await router.handle(req, res);
  return { res, data: JSON.parse(res.body) };
}

// ── POST /api/v1/auth/register ────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new player and returns 201 on first registration', async () => {
    mockPlayerFindOne.mockResolvedValue(null);
    mockPlayerCreate.mockResolvedValue({
      friendCode: '12345678',
      trainerName: 'Ash',
    });
    const { res, data } = await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: PLAYER_ID,
        trainerName: 'Ash',
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(data.friendCode).toBe('12345678');
    expect(data.alreadyRegistered).toBe(false);
    expect(data.nameUpdated).toBe(false);
  });

  it('forwards isFemale and spriteId to Player.create on first registration', async () => {
    mockPlayerFindOne.mockResolvedValue(null);
    mockPlayerCreate.mockResolvedValue({
      friendCode: '12345678',
      trainerName: 'Misty',
    });
    await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: PLAYER_ID,
        trainerName: 'Misty',
        isFemale: true,
        spriteId: 'trainer_misty',
      }),
    );
    expect(mockPlayerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ isFemale: true, spriteId: 'trainer_misty' }),
    );
  });

  it('omits isFemale and spriteId from Player.create when not provided', async () => {
    mockPlayerFindOne.mockResolvedValue(null);
    mockPlayerCreate.mockResolvedValue({
      friendCode: '12345678',
      trainerName: 'Ash',
    });
    await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: PLAYER_ID,
        trainerName: 'Ash',
      }),
    );
    const arg = mockPlayerCreate.mock.calls[0][0];
    expect(arg).not.toHaveProperty('isFemale');
    expect(arg).not.toHaveProperty('spriteId');
  });

  it('returns 200 with alreadyRegistered=true on re-login without name change', async () => {
    mockPlayerFindOne.mockResolvedValue({
      _id: 'id',
      friendCode: '12345678',
      trainerName: 'Ash',
    });
    mockPlayerFindByIdAndUpdate.mockResolvedValue({});
    const { res, data } = await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: PLAYER_ID,
        trainerName: 'Ash',
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(data.alreadyRegistered).toBe(true);
    expect(data.nameUpdated).toBe(false);
  });

  it('updates trainerName on re-login when name changed', async () => {
    mockPlayerFindOne.mockResolvedValue({
      _id: 'id',
      friendCode: '12345678',
      trainerName: 'OldName',
    });
    mockPlayerFindByIdAndUpdate.mockResolvedValue({});
    const { res, data } = await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: PLAYER_ID,
        trainerName: 'NewName',
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(data.nameUpdated).toBe(true);
    expect(mockPlayerFindByIdAndUpdate).toHaveBeenCalledWith(
      'id',
      expect.objectContaining({ trainerName: 'NewName' }),
    );
  });

  it('updates isFemale and spriteId on re-login when provided', async () => {
    mockPlayerFindOne.mockResolvedValue({
      _id: 'id',
      friendCode: '12345678',
      trainerName: 'Ash',
    });
    mockPlayerFindByIdAndUpdate.mockResolvedValue({});
    await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: PLAYER_ID,
        trainerName: 'Ash',
        isFemale: true,
        spriteId: 'trainer_new',
      }),
    );
    expect(mockPlayerFindByIdAndUpdate).toHaveBeenCalledWith(
      'id',
      expect.objectContaining({ isFemale: true, spriteId: 'trainer_new' }),
    );
  });

  it('refreshes expiresAt on re-login', async () => {
    mockPlayerFindOne.mockResolvedValue({
      _id: 'id',
      friendCode: '12345678',
      trainerName: 'Ash',
    });
    mockPlayerFindByIdAndUpdate.mockResolvedValue({});
    await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: PLAYER_ID,
        trainerName: 'Ash',
      }),
    );
    expect(mockPlayerFindByIdAndUpdate).toHaveBeenCalledWith(
      'id',
      expect.objectContaining({ expiresAt: expect.any(Date) }),
    );
  });

  it('returns 400 when playerId is missing', async () => {
    const { res } = await call(
      makeReq('POST', '/api/v1/auth/register', { trainerName: 'Ash' }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when trainerName is missing', async () => {
    const { res } = await call(
      makeReq('POST', '/api/v1/auth/register', { playerId: PLAYER_ID }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when trainerName exceeds 16 characters', async () => {
    const { res } = await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: PLAYER_ID,
        trainerName: 'A'.repeat(17),
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when playerId exceeds 64 characters', async () => {
    const { res } = await call(
      makeReq('POST', '/api/v1/auth/register', {
        playerId: 'a'.repeat(65),
        trainerName: 'Ash',
      }),
    );
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /api/v1/auth/profile ────────────────────────────────────────────────

describe('PATCH /api/v1/auth/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  const withPlayer = { 'x-player-id': PLAYER_ID };

  it('updates trainerName and returns 200', async () => {
    mockPlayerFindOneAndUpdate.mockResolvedValue({
      trainerName: 'Gary',
      isFemale: false,
      spriteId: '',
      profileMessage: '',
    });
    const { res, data } = await call(
      makeReq(
        'PATCH',
        '/api/v1/auth/profile',
        { trainerName: 'Gary' },
        withPlayer,
      ),
    );
    expect(res.statusCode).toBe(200);
    expect(data.trainerName).toBe('Gary');
  });

  it('updates isFemale and spriteId', async () => {
    mockPlayerFindOneAndUpdate.mockResolvedValue({
      trainerName: 'Misty',
      isFemale: true,
      spriteId: 'trainer_misty',
      profileMessage: '',
    });
    const { res, data } = await call(
      makeReq(
        'PATCH',
        '/api/v1/auth/profile',
        { isFemale: true, spriteId: 'trainer_misty' },
        withPlayer,
      ),
    );
    expect(res.statusCode).toBe(200);
    expect(data.isFemale).toBe(true);
    expect(data.spriteId).toBe('trainer_misty');
  });

  it('updates profileMessage', async () => {
    mockPlayerFindOneAndUpdate.mockResolvedValue({
      trainerName: 'Ash',
      isFemale: false,
      spriteId: '',
      profileMessage: 'Hello!',
    });
    const { res, data } = await call(
      makeReq(
        'PATCH',
        '/api/v1/auth/profile',
        { profileMessage: 'Hello!' },
        withPlayer,
      ),
    );
    expect(res.statusCode).toBe(200);
    expect(data.profileMessage).toBe('Hello!');
  });

  it('passes expiresAt to the update', async () => {
    mockPlayerFindOneAndUpdate.mockResolvedValue({
      trainerName: 'Ash',
      isFemale: false,
      spriteId: '',
      profileMessage: '',
    });
    await call(
      makeReq(
        'PATCH',
        '/api/v1/auth/profile',
        { trainerName: 'Ash' },
        withPlayer,
      ),
    );
    expect(mockPlayerFindOneAndUpdate).toHaveBeenCalledWith(
      { playerId: PLAYER_ID },
      expect.objectContaining({ expiresAt: expect.any(Date) }),
      { new: true },
    );
  });

  it('returns 404 when player does not exist', async () => {
    mockPlayerFindOneAndUpdate.mockResolvedValue(null);
    const { res } = await call(
      makeReq(
        'PATCH',
        '/api/v1/auth/profile',
        { trainerName: 'Ghost' },
        withPlayer,
      ),
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when no field is provided', async () => {
    const { res } = await call(
      makeReq('PATCH', '/api/v1/auth/profile', {}, withPlayer),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when trainerName exceeds 16 characters', async () => {
    const { res } = await call(
      makeReq(
        'PATCH',
        '/api/v1/auth/profile',
        { trainerName: 'A'.repeat(17) },
        withPlayer,
      ),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when profileMessage exceeds 256 characters', async () => {
    const { res } = await call(
      makeReq(
        'PATCH',
        '/api/v1/auth/profile',
        { profileMessage: 'x'.repeat(257) },
        withPlayer,
      ),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when x-player-id header is missing', async () => {
    const { res } = await call(
      makeReq('PATCH', '/api/v1/auth/profile', { trainerName: 'Ash' }),
    );
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /api/v1/auth/profile ───────────────────────────────────────────────

describe('DELETE /api/v1/auth/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  const withPlayer = { 'x-player-id': PLAYER_ID };

  it('deletes the player and returns 200 when confirm is true', async () => {
    mockDeletePlayer.mockResolvedValue({ ok: true });
    const { res, data } = await call(
      makeReq('DELETE', '/api/v1/auth/profile', { confirm: true }, withPlayer),
    );
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockDeletePlayer).toHaveBeenCalledWith(PLAYER_ID);
  });

  it('returns 404 when player does not exist', async () => {
    mockDeletePlayer.mockResolvedValue({
      ok: false,
      error: 'Player not found',
    });
    const { res } = await call(
      makeReq('DELETE', '/api/v1/auth/profile', { confirm: true }, withPlayer),
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when confirm is missing', async () => {
    const { res } = await call(
      makeReq('DELETE', '/api/v1/auth/profile', {}, withPlayer),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when confirm is false', async () => {
    const { res } = await call(
      makeReq('DELETE', '/api/v1/auth/profile', { confirm: false }, withPlayer),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when x-player-id header is missing', async () => {
    const { res } = await call(
      makeReq('DELETE', '/api/v1/auth/profile', { confirm: true }),
    );
    expect(res.statusCode).toBe(400);
  });
});
