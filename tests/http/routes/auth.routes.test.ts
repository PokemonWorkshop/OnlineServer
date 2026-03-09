/**
 * Tests for src/http/routes/auth.routes.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Router, sendJson } from '../../../src/http/router';
import { registerAuthRoutes } from '../../../src/http/routes/auth.routes';

const mockPlayerFindOne = vi.fn();
const mockPlayerCreate = vi.fn();
const mockPlayerFindByIdAndUpdate = vi.fn();
const mockPlayerSave = vi.fn();

vi.mock('../../../src/models/Player', () => ({
  Player: {
    findOne: (...args: any[]) => mockPlayerFindOne(...args),
    create: (...args: any[]) => mockPlayerCreate(...args),
    findByIdAndUpdate: (...args: any[]) => mockPlayerFindByIdAndUpdate(...args),
  },
}));

vi.mock('../../../src/services/FriendService', () => ({
  FriendService: {
    generateFriendCode: () => '12345678',
  },
}));

function makePostReq(body: unknown): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = 'POST';
  req.url = '/api/v1/auth/register';
  req.headers = { 'x-api-key': 'test-api-key' };
  const jsonBody = JSON.stringify(body);
  process.nextTick(() => {
    req.emit('data', Buffer.from(jsonBody));
    req.emit('end');
  });
  return req;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: '',
    headers: {} as Record<string, string | number>,
    setHeader: vi.fn((k: string, v: string | number) => { res.headers[k] = v; }),
    writeHead: vi.fn((s: number, h?: Record<string, string | number>) => {
      res.statusCode = s;
      if (h) Object.assign(res.headers, h);
    }),
    end: vi.fn((b?: string) => { res.body = b ?? ''; }),
  } as unknown as ServerResponse & { statusCode: number; body: string };
  return res;
}

async function callRoute(body: unknown) {
  const router = new Router();
  registerAuthRoutes(router);
  const req = makePostReq(body);
  const res = makeRes();
  await router.handle(req, res);
  return { res, data: JSON.parse(res.body) };
}

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a new player and returns 201 on first registration', async () => {
    mockPlayerFindOne.mockResolvedValue(null);
    mockPlayerCreate.mockResolvedValue({ friendCode: '12345678', trainerName: 'Ash' });
    const { res, data } = await callRoute({ playerId: 'ash-uuid', trainerName: 'Ash' });
    expect(res.statusCode).toBe(201);
    expect(data.friendCode).toBe('12345678');
    expect(data.trainerName).toBe('Ash');
    expect(data.alreadyRegistered).toBe(false);
    expect(data.nameUpdated).toBe(false);
  });

  it('returns 200 with alreadyRegistered=true on re-login without name change', async () => {
    mockPlayerFindOne.mockResolvedValue({
      _id: 'mongo-id', friendCode: '12345678', trainerName: 'Ash', lastSeen: new Date(),
    });
    mockPlayerFindByIdAndUpdate.mockResolvedValue({});
    const { res, data } = await callRoute({ playerId: 'ash-uuid', trainerName: 'Ash' });
    expect(res.statusCode).toBe(200);
    expect(data.alreadyRegistered).toBe(true);
    expect(data.nameUpdated).toBe(false);
  });

  it('returns 200 with nameUpdated=true when the trainer name changed', async () => {
    const mockPlayer = {
      _id: 'mongo-id', friendCode: '12345678', trainerName: 'OldName',
      lastSeen: new Date(), save: mockPlayerSave,
    };
    mockPlayerFindOne.mockResolvedValue(mockPlayer);
    mockPlayerSave.mockResolvedValue({});
    const { res, data } = await callRoute({ playerId: 'ash-uuid', trainerName: 'NewName' });
    expect(res.statusCode).toBe(200);
    expect(data.alreadyRegistered).toBe(true);
    expect(data.nameUpdated).toBe(true);
    expect(data.trainerName).toBe('NewName');
    expect(mockPlayerSave).toHaveBeenCalledOnce();
  });

  it('returns 400 when playerId is missing', async () => {
    const { res, data } = await callRoute({ trainerName: 'Ash' });
    expect(res.statusCode).toBe(400);
    expect(data.error).toBe('Invalid data');
  });

  it('returns 400 when trainerName is missing', async () => {
    const { res, data } = await callRoute({ playerId: 'ash-uuid' });
    expect(res.statusCode).toBe(400);
    expect(data.error).toBe('Invalid data');
  });

  it('returns 400 when trainerName is too long (>16 chars)', async () => {
    const { res, data } = await callRoute({ playerId: 'ash-uuid', trainerName: 'ThisNameIsTooLongForThisGame' });
    expect(res.statusCode).toBe(400);
    expect(data.error).toBe('Invalid data');
  });

  it('returns 400 when playerId is too long (>64 chars)', async () => {
    const { res, data } = await callRoute({ playerId: 'a'.repeat(65), trainerName: 'Ash' });
    expect(res.statusCode).toBe(400);
    expect(data.error).toBe('Invalid data');
  });

  it('returns 400 for a non-JSON body', async () => {
    const router = new Router();
    registerAuthRoutes(router);
    const req = new EventEmitter() as IncomingMessage;
    req.method = 'POST';
    req.url = '/api/v1/auth/register';
    req.headers = { 'x-api-key': 'test-api-key' };
    process.nextTick(() => { req.emit('data', Buffer.from('not-json')); req.emit('end'); });
    const res = makeRes();
    await router.handle(req, res);
    expect(res.statusCode).toBe(400);
  });
});
