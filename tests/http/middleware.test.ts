/**
 * Tests for src/http/middleware.ts
 *
 * Covers: apiKeyMiddleware, extractPlayer, requireAdmin, verifyWsApiKey
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import {
  apiKeyMiddleware,
  extractPlayer,
  requireAdmin,
  verifyWsApiKey,
} from '../../src/http/middleware';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(url: string, headers: Record<string, string> = {}): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.url     = url;
  req.method  = 'GET';
  req.headers = headers;
  return req;
}

function makeRes() {
  let statusCode = 0;
  let body       = '';
  const res = {
    statusCode,
    headers: {} as Record<string, string | number>,
    body: '',
    setHeader: vi.fn(),
    writeHead: vi.fn((s: number) => { res.statusCode = s; statusCode = s; }),
    end:       vi.fn((b?: string) => { res.body = b ?? ''; body = res.body; }),
  } as unknown as ServerResponse & { statusCode: number; body: string };
  return res;
}

// ── apiKeyMiddleware ──────────────────────────────────────────────────────────

describe('apiKeyMiddleware', () => {
  it('allows requests with the correct x-api-key', async () => {
    const req = makeReq('/api/v1/gts/deposit', { 'x-api-key': 'test-api-key' });
    const res = makeRes();
    const result = await apiKeyMiddleware(req, res);
    expect(result).toBe(true);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('rejects requests with a wrong x-api-key (401)', async () => {
    const req = makeReq('/api/v1/gts/deposit', { 'x-api-key': 'wrong-key' });
    const res = makeRes();
    const result = await apiKeyMiddleware(req, res);
    expect(result).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('rejects requests with no api key (401)', async () => {
    const req = makeReq('/api/v1/gts/deposit', {});
    const res = makeRes();
    const result = await apiKeyMiddleware(req, res);
    expect(result).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('always allows /telemetry (dashboard HTML)', async () => {
    const req = makeReq('/telemetry', {});
    const res = makeRes();
    const result = await apiKeyMiddleware(req, res);
    expect(result).toBe(true);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('allows admin route /telemetry/summary with valid admin key', async () => {
    const req = makeReq('/telemetry/summary', { 'x-admin-key': 'test-admin-key' });
    const res = makeRes();
    const result = await apiKeyMiddleware(req, res);
    expect(result).toBe(true);
  });

  it('allows mystery-gift admin route with valid admin key', async () => {
    const req = makeReq('/api/v1/mystery-gift/admin/create', {
      'x-admin-key': 'test-admin-key',
    });
    const res = makeRes();
    const result = await apiKeyMiddleware(req, res);
    expect(result).toBe(true);
  });

  it('falls through to API_KEY check for admin route with wrong admin key', async () => {
    const req = makeReq('/api/v1/mystery-gift/admin/create', {
      'x-admin-key': 'bad-admin-key',
    });
    const res = makeRes();
    const result = await apiKeyMiddleware(req, res);
    expect(result).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});

// ── extractPlayer ─────────────────────────────────────────────────────────────

describe('extractPlayer', () => {
  it('extracts x-player-id and attaches it to req.playerId', () => {
    const req = makeReq('/api/v1/gts/deposit', { 'x-player-id': 'player123' });
    const res = makeRes();
    const result = extractPlayer(req, res);
    expect(result).toBe(true);
    expect((req as any).playerId).toBe('player123');
  });

  it('trims whitespace from x-player-id', () => {
    const req = makeReq('/', { 'x-player-id': '  player123  ' });
    const res = makeRes();
    extractPlayer(req, res);
    expect((req as any).playerId).toBe('player123');
  });

  it('returns false and sends 400 when x-player-id is missing', () => {
    const req = makeReq('/', {});
    const res = makeRes();
    const result = extractPlayer(req, res);
    expect(result).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ error: expect.stringContaining('Player-Id') });
  });

  it('returns false and sends 400 when x-player-id is blank', () => {
    const req = makeReq('/', { 'x-player-id': '   ' });
    const res = makeRes();
    const result = extractPlayer(req, res);
    expect(result).toBe(false);
    expect(res.statusCode).toBe(400);
  });
});

// ── requireAdmin ──────────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  it('returns true for the correct admin key', () => {
    const req = makeReq('/', { 'x-admin-key': 'test-admin-key' });
    const res = makeRes();
    expect(requireAdmin(req, res)).toBe(true);
  });

  it('returns false (401) for a wrong admin key', () => {
    const req = makeReq('/', { 'x-admin-key': 'hacker' });
    const res = makeRes();
    const result = requireAdmin(req, res);
    expect(result).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('returns false (401) when admin key is absent', () => {
    const req = makeReq('/', {});
    const res = makeRes();
    const result = requireAdmin(req, res);
    expect(result).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ error: expect.stringContaining('Admin Key') });
  });
});

// ── verifyWsApiKey ────────────────────────────────────────────────────────────

describe('verifyWsApiKey', () => {
  it('returns true for the correct API key', () => {
    expect(verifyWsApiKey('test-api-key')).toBe(true);
  });

  it('returns false for an incorrect API key', () => {
    expect(verifyWsApiKey('wrong')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(verifyWsApiKey('')).toBe(false);
  });
});
