/**
 * Tests for src/http/routes/mysteryGift.routes.ts
 *
 * Covers:
 * - GET    /api/v1/mystery-gift             (player, needs x-player-id)
 * - POST   /api/v1/mystery-gift/claim       (player, needs x-player-id)
 * - POST   /api/v1/mystery-gift/admin/create (admin, needs x-admin-key)
 * - DELETE /api/v1/mystery-gift/admin/:giftId (admin)
 * - POST   /api/v1/mystery-gift/admin/purge  (admin)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Router } from '../../../src/http/router';
import { registerMysteryGiftRoutes } from '../../../src/http/routes/mysteryGift.routes';

// ── Mock MysteryGiftService ───────────────────────────────────────────────────

const mockListForPlayer = vi.fn();
const mockClaim         = vi.fn();
const mockCreate        = vi.fn();
const mockDeactivate    = vi.fn();
const mockPurgeExpired  = vi.fn();

vi.mock('../../../src/services/MysteryGiftService', () => ({
  mysteryGiftService: {
    listForPlayer: (...a: any[]) => mockListForPlayer(...a),
    claim:         (...a: any[]) => mockClaim(...a),
    create:        (...a: any[]) => mockCreate(...a),
    deactivate:    (...a: any[]) => mockDeactivate(...a),
    purgeExpired:  (...a: any[]) => mockPurgeExpired(...a),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: unknown,
): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method  = method;
  req.url     = url;
  req.headers = headers;
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
  } as unknown as ServerResponse & {
    statusCode: number;
    body: string;
    headers: Record<string, string | number>;
  };
  return res;
}

async function call(req: IncomingMessage) {
  const router = new Router();
  registerMysteryGiftRoutes(router);
  const res = makeRes();
  await router.handle(req, res);
  return { res, data: JSON.parse(res.body || 'null') };
}

const PLAYER_HEADERS = { 'x-player-id': 'player-gift-tester' };
const ADMIN_HEADERS  = { 'x-admin-key': 'test-admin-key' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/mystery-gift', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns internet gifts available for the player', async () => {
    const gifts = [{ title: 'Starter Pack', type: 'internet' }];
    mockListForPlayer.mockResolvedValue(gifts);
    const { res, data } = await call(makeReq('GET', '/api/v1/mystery-gift', PLAYER_HEADERS));
    expect(res.statusCode).toBe(200);
    expect(data).toEqual(gifts);
  });

  it('returns 400 when x-player-id is missing', async () => {
    const { res } = await call(makeReq('GET', '/api/v1/mystery-gift', {}));
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/mystery-gift/claim', () => {
  beforeEach(() => vi.clearAllMocks());

  it('claims by giftId and returns 200', async () => {
    mockClaim.mockResolvedValue({ ok: true });
    const { res, data } = await call(
      makeReq('POST', '/api/v1/mystery-gift/claim', PLAYER_HEADERS, { giftId: 'gift-abc' }),
    );
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('claims by code and returns 200', async () => {
    mockClaim.mockResolvedValue({ ok: true });
    const { res, data } = await call(
      makeReq('POST', '/api/v1/mystery-gift/claim', PLAYER_HEADERS, { code: 'MYSECRETCODE' }),
    );
    expect(res.statusCode).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('returns 400 when neither code nor giftId is provided', async () => {
    const { res } = await call(
      makeReq('POST', '/api/v1/mystery-gift/claim', PLAYER_HEADERS, {}),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when the service rejects (already claimed)', async () => {
    mockClaim.mockResolvedValue({ ok: false, error: 'Already claimed' });
    const { res } = await call(
      makeReq('POST', '/api/v1/mystery-gift/claim', PLAYER_HEADERS, { giftId: 'gift-abc' }),
    );
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/mystery-gift/admin/create', () => {
  beforeEach(() => vi.clearAllMocks());

  const validInternetGift = {
    title:    'Internet Gift',
    type:     'internet',
    items:    [{ id: 'item001', count: 1 }],
    maxClaims: -1,
    alwaysAvailable: true,
  };

  it('creates an internet gift and returns 201', async () => {
    mockCreate.mockResolvedValue({ _id: 'gift-new', ...validInternetGift });
    const { res, data } = await call(
      makeReq('POST', '/api/v1/mystery-gift/admin/create', ADMIN_HEADERS, validInternetGift),
    );
    expect(res.statusCode).toBe(201);
    expect(data._id).toBe('gift-new');
  });

  it('creates a code gift with a code field', async () => {
    mockCreate.mockResolvedValue({ _id: 'gift-code', type: 'code' });
    const codeGift = {
      title: 'Secret Code Gift',
      type:  'code',
      code:  'SECRETCODE',
      items: [{ id: 'item001', count: 1 }],
    };
    const { res } = await call(
      makeReq('POST', '/api/v1/mystery-gift/admin/create', ADMIN_HEADERS, codeGift),
    );
    expect(res.statusCode).toBe(201);
  });

  it('returns 400 when code gift is missing the code field', async () => {
    const badGift = {
      title: 'Code Gift Without Code',
      type:  'code',
      items: [{ id: 'item001', count: 1 }],
    };
    const { res, data } = await call(
      makeReq('POST', '/api/v1/mystery-gift/admin/create', ADMIN_HEADERS, badGift),
    );
    expect(res.statusCode).toBe(400);
    expect(data.error).toBe('Invalid data');
  });

  it('returns 400 when the gift has no content (no items/creatures/eggs)', async () => {
    const emptyGift = {
      title: 'Empty Gift',
      type:  'internet',
    };
    const { res } = await call(
      makeReq('POST', '/api/v1/mystery-gift/admin/create', ADMIN_HEADERS, emptyGift),
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when admin key is missing', async () => {
    const { res } = await call(
      makeReq('POST', '/api/v1/mystery-gift/admin/create', {}, validInternetGift),
    );
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when service throws an error', async () => {
    mockCreate.mockRejectedValue(new Error('Duplicate title'));
    const { res, data } = await call(
      makeReq('POST', '/api/v1/mystery-gift/admin/create', ADMIN_HEADERS, validInternetGift),
    );
    expect(res.statusCode).toBe(400);
    expect(data.error).toBe('Duplicate title');
  });
});

describe('DELETE /api/v1/mystery-gift/admin/:giftId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deactivates a gift and returns 200', async () => {
    mockDeactivate.mockResolvedValue({ ok: true });
    const { res } = await call(
      makeReq('DELETE', '/api/v1/mystery-gift/admin/gift-123', ADMIN_HEADERS),
    );
    expect(res.statusCode).toBe(200);
    expect(mockDeactivate).toHaveBeenCalledWith('gift-123');
  });

  it('returns 404 when the gift is not found', async () => {
    mockDeactivate.mockResolvedValue({ ok: false, error: 'Gift not found' });
    const { res } = await call(
      makeReq('DELETE', '/api/v1/mystery-gift/admin/ghost-gift', ADMIN_HEADERS),
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 when admin key is missing', async () => {
    const { res } = await call(
      makeReq('DELETE', '/api/v1/mystery-gift/admin/gift-123', {}),
    );
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/v1/mystery-gift/admin/purge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('purges expired gifts and returns the count', async () => {
    mockPurgeExpired.mockResolvedValue(7);
    const { res, data } = await call(
      makeReq('POST', '/api/v1/mystery-gift/admin/purge', ADMIN_HEADERS),
    );
    expect(res.statusCode).toBe(200);
    expect(data.deleted).toBe(7);
  });
});
