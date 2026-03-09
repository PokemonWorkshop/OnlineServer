/**
 * Tests for src/http/routes/bank.routes.ts
 *
 * Covers:
 * - GET  /api/v1/bank/boxes
 * - POST /api/v1/bank/deposit
 * - POST /api/v1/bank/withdraw
 *
 * All requests need `x-player-id` header (checked by extractPlayer).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Router } from '../../../src/http/router';
import { registerBankRoutes } from '../../../src/http/routes/bank.routes';

// ── Mock BankService ──────────────────────────────────────────────────────────

const mockGetBoxes         = vi.fn();
const mockDepositCreature  = vi.fn();
const mockWithdrawCreature = vi.fn();

vi.mock('../../../src/services/BankService', () => ({
  bankService: {
    getBoxes:         (...a: any[]) => mockGetBoxes(...a),
    depositCreature:  (...a: any[]) => mockDepositCreature(...a),
    withdrawCreature: (...a: any[]) => mockWithdrawCreature(...a),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAYER_ID = 'player-abc';

function makeReq(method: string, url: string, body?: unknown): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method  = method;
  req.url     = url;
  req.headers = { 'x-player-id': PLAYER_ID };
  if (body !== undefined) {
    const json = JSON.stringify(body);
    process.nextTick(() => {
      req.emit('data', Buffer.from(json));
      req.emit('end');
    });
  } else {
    process.nextTick(() => req.emit('end'));
  }
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

function makeReqNoPlayer(method: string, url: string): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method  = method;
  req.url     = url;
  req.headers = {};
  process.nextTick(() => req.emit('end'));
  return req;
}

async function call(req: IncomingMessage) {
  const router = new Router();
  registerBankRoutes(router);
  const res = makeRes();
  await router.handle(req, res);
  return { res, data: JSON.parse(res.body || 'null') };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/bank/boxes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the player boxes with status 200', async () => {
    const boxes = [{ boxIndex: 0, slots: [] }];
    mockGetBoxes.mockResolvedValue(boxes);

    const { res, data } = await call(makeReq('GET', '/api/v1/bank/boxes'));
    expect(res.statusCode).toBe(200);
    expect(data).toEqual(boxes);
    expect(mockGetBoxes).toHaveBeenCalledWith(PLAYER_ID);
  });

  it('returns 400 when x-player-id header is missing', async () => {
    const { res } = await call(makeReqNoPlayer('GET', '/api/v1/bank/boxes'));
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/bank/deposit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deposits a creature and returns 200 on success', async () => {
    mockDepositCreature.mockResolvedValue({ ok: true });
    const body = { boxIndex: 0, slotIndex: 1, creature: { speciesId: '001' } };
    const { res, data } = await call(makeReq('POST', '/api/v1/bank/deposit', body));
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockDepositCreature).toHaveBeenCalledWith(PLAYER_ID, 0, 1, { speciesId: '001' });
  });

  it('returns 400 when service reports an error (slot occupied)', async () => {
    mockDepositCreature.mockResolvedValue({ ok: false, error: 'This slot is already occupied' });
    const body = { boxIndex: 0, slotIndex: 0, creature: { speciesId: '001' } };
    const { res, data } = await call(makeReq('POST', '/api/v1/bank/deposit', body));
    expect(res.statusCode).toBe(400);
    expect(data.ok).toBe(false);
  });

  it('returns 400 when boxIndex is missing', async () => {
    const body = { slotIndex: 0, creature: { speciesId: '001' } };
    const { res } = await call(makeReq('POST', '/api/v1/bank/deposit', body));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when creature is missing', async () => {
    const body = { boxIndex: 0, slotIndex: 0 };
    const { res } = await call(makeReq('POST', '/api/v1/bank/deposit', body));
    expect(res.statusCode).toBe(400);
  });

  it('coerces string boxIndex/slotIndex to numbers', async () => {
    mockDepositCreature.mockResolvedValue({ ok: true });
    const body = { boxIndex: '2', slotIndex: '5', creature: { speciesId: '004' } };
    await call(makeReq('POST', '/api/v1/bank/deposit', body));
    expect(mockDepositCreature).toHaveBeenCalledWith(PLAYER_ID, 2, 5, expect.anything());
  });
});

describe('POST /api/v1/bank/withdraw', () => {
  beforeEach(() => vi.clearAllMocks());

  it('withdraws a creature and returns 200 with the creature', async () => {
    const creature = { speciesId: '007', level: 10 };
    mockWithdrawCreature.mockResolvedValue({ ok: true, creature });
    const body = { boxIndex: 0, slotIndex: 2 };
    const { res, data } = await call(makeReq('POST', '/api/v1/bank/withdraw', body));
    expect(res.statusCode).toBe(200);
    expect(data.creature).toEqual(creature);
  });

  it('returns 400 when the slot is empty', async () => {
    mockWithdrawCreature.mockResolvedValue({ ok: false, error: 'This slot is empty' });
    const body = { boxIndex: 0, slotIndex: 5 };
    const { res, data } = await call(makeReq('POST', '/api/v1/bank/withdraw', body));
    expect(res.statusCode).toBe(400);
    expect(data.ok).toBe(false);
  });

  it('returns 400 when slotIndex is missing', async () => {
    const body = { boxIndex: 0 };
    const { res } = await call(makeReq('POST', '/api/v1/bank/withdraw', body));
    expect(res.statusCode).toBe(400);
  });
});
