/**
 * Tests for src/http/routes/gts.routes.ts
 *
 * Covers:
 * - GET    /api/v1/gts/deposit
 * - POST   /api/v1/gts/deposit
 * - GET    /api/v1/gts/search?speciesId=&level=&gender=&page=
 * - POST   /api/v1/gts/trade/:depositId
 * - DELETE /api/v1/gts/deposit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Router } from '../../../src/http/router';
import { registerGtsRoutes } from '../../../src/http/routes/gts.routes';

// ── Mock GtsService ───────────────────────────────────────────────────────────

const mockGetMyDeposit = vi.fn();
const mockDeposit      = vi.fn();
const mockSearch       = vi.fn();
const mockTrade        = vi.fn();
const mockWithdraw     = vi.fn();

vi.mock('../../../src/services/GtsService', () => ({
  gtsService: {
    getMyDeposit: (...a: any[]) => mockGetMyDeposit(...a),
    deposit:      (...a: any[]) => mockDeposit(...a),
    search:       (...a: any[]) => mockSearch(...a),
    trade:        (...a: any[]) => mockTrade(...a),
    withdraw:     (...a: any[]) => mockWithdraw(...a),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAYER_ID = 'trainer-gts';

function makeReq(method: string, url: string, body?: unknown): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method  = method;
  req.url     = url;
  req.headers = { 'x-player-id': PLAYER_ID };
  if (body !== undefined) {
    const json = JSON.stringify(body);
    process.nextTick(() => { req.emit('data', Buffer.from(json)); req.emit('end'); });
  } else {
    process.nextTick(() => req.emit('end'));
  }
  return req;
}

function makeRes() {
  const res = {
    statusCode: 0, body: '', headers: {} as Record<string, string | number>,
    setHeader: vi.fn((k: string, v: string | number) => { res.headers[k] = v; }),
    writeHead: vi.fn((s: number, h?: Record<string, string | number>) => {
      res.statusCode = s; if (h) Object.assign(res.headers, h);
    }),
    end: vi.fn((b?: string) => { res.body = b ?? ''; }),
  } as unknown as ServerResponse & { statusCode: number; body: string };
  return res;
}

async function call(req: IncomingMessage) {
  const router = new Router();
  registerGtsRoutes(router);
  const res = makeRes();
  await router.handle(req, res);
  return { res, data: JSON.parse(res.body || 'null') };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/gts/deposit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the player deposit when it exists', async () => {
    const deposit = { _id: 'dep1', wantedSpeciesId: '006' };
    mockGetMyDeposit.mockResolvedValue(deposit);
    const { res, data } = await call(makeReq('GET', '/api/v1/gts/deposit'));
    expect(res.statusCode).toBe(200);
    expect(data).toEqual(deposit);
  });

  it('returns null when the player has no deposit', async () => {
    mockGetMyDeposit.mockResolvedValue(undefined);
    const { res, data } = await call(makeReq('GET', '/api/v1/gts/deposit'));
    expect(res.statusCode).toBe(200);
    expect(data).toBeNull();
  });
});

describe('POST /api/v1/gts/deposit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a deposit and returns 201', async () => {
    mockDeposit.mockResolvedValue({ ok: true, depositId: 'new-dep-id' });
    const body = {
      creature: { speciesId: '004', level: 5, trainerName: 'Ash' },
      wanted:   { speciesId: '006' },
    };
    const { res, data } = await call(makeReq('POST', '/api/v1/gts/deposit', body));
    expect(res.statusCode).toBe(201);
    expect(data.ok).toBe(true);
  });

  it('returns 400 when creature is missing', async () => {
    const body = { wanted: { speciesId: '006' } };
    const { res } = await call(makeReq('POST', '/api/v1/gts/deposit', body));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when wanted.speciesId is missing', async () => {
    const body = { creature: { speciesId: '004' } };
    const { res } = await call(makeReq('POST', '/api/v1/gts/deposit', body));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when service rejects (player already has a deposit)', async () => {
    mockDeposit.mockResolvedValue({ ok: false, error: 'You already have a creature deposited' });
    const body = {
      creature: { speciesId: '004' },
      wanted:   { speciesId: '006' },
    };
    const { res, data } = await call(makeReq('POST', '/api/v1/gts/deposit', body));
    expect(res.statusCode).toBe(400);
    expect(data.ok).toBe(false);
  });
});

describe('GET /api/v1/gts/search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('searches GTS and returns results', async () => {
    const results = [{ depositId: 'dep1' }];
    mockSearch.mockResolvedValue(results);
    const { res, data } = await call(
      makeReq('GET', '/api/v1/gts/search?speciesId=006&level=50&gender=1&page=0'),
    );
    expect(res.statusCode).toBe(200);
    expect(data).toEqual(results);
    expect(mockSearch).toHaveBeenCalledWith('006', 50, 1, 0);
  });

  it('returns 400 when speciesId is missing', async () => {
    const { res } = await call(makeReq('GET', '/api/v1/gts/search?level=50&gender=1'));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when level is missing', async () => {
    const { res } = await call(makeReq('GET', '/api/v1/gts/search?speciesId=006&gender=1'));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when gender is missing', async () => {
    const { res } = await call(makeReq('GET', '/api/v1/gts/search?speciesId=006&level=50'));
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/gts/trade/:depositId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('executes a trade and returns 200', async () => {
    mockTrade.mockResolvedValue({ ok: true });
    const body = { offeredCreature: { speciesId: '007', level: 15 } };
    const { res, data } = await call(makeReq('POST', '/api/v1/gts/trade/dep123', body));
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockTrade).toHaveBeenCalledWith(PLAYER_ID, 'dep123', body.offeredCreature);
  });

  it('returns 400 when offeredCreature is missing', async () => {
    const { res } = await call(makeReq('POST', '/api/v1/gts/trade/dep123', {}));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when service rejects the trade', async () => {
    mockTrade.mockResolvedValue({ ok: false, error: 'Wanted species mismatch' });
    const body = { offeredCreature: { speciesId: '999' } };
    const { res } = await call(makeReq('POST', '/api/v1/gts/trade/dep123', body));
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /api/v1/gts/deposit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('withdraws a deposit and returns 200', async () => {
    mockWithdraw.mockResolvedValue({ ok: true });
    const { res } = await call(makeReq('DELETE', '/api/v1/gts/deposit'));
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 when player has no active deposit', async () => {
    mockWithdraw.mockResolvedValue({ ok: false, error: 'No active deposit found' });
    const { res } = await call(makeReq('DELETE', '/api/v1/gts/deposit'));
    expect(res.statusCode).toBe(404);
  });
});
