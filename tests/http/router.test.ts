/**
 * Tests for src/http/router.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import {
  Router,
  sendJson,
  readBody,
  getQuery,
  getHeader,
} from '../../src/http/router';

function makeMockRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string | number>,
    body: '',
    setHeader: vi.fn((k: string, v: string | number) => {
      res.headers[k] = v;
    }),
    writeHead: vi.fn(
      (status: number, headers?: Record<string, string | number>) => {
        res.statusCode = status;
        if (headers) Object.assign(res.headers, headers);
      },
    ),
    end: vi.fn((body?: string) => {
      res.body = body ?? '';
    }),
  } as unknown as ServerResponse & {
    statusCode: number;
    headers: Record<string, string | number>;
    body: string;
  };
  return res;
}

function makeMockReq(
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): IncomingMessage {
  const ee = new EventEmitter() as IncomingMessage;
  ee.method = options.method ?? 'GET';
  ee.url = options.url ?? '/';
  ee.headers = options.headers ?? {};

  if (options.body !== undefined) {
    const bodyStr = options.body;
    process.nextTick(() => {
      ee.emit('data', Buffer.from(bodyStr));
      ee.emit('end');
    });
  }

  return ee;
}

describe('sendJson', () => {
  it('writes the correct status and JSON body', () => {
    const res = makeMockRes();
    sendJson(res, 200, { hello: 'world' });
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    );
    expect(JSON.parse(res.body)).toEqual({ hello: 'world' });
  });

  it('sets Content-Length matching the body byte length', () => {
    const res = makeMockRes();
    sendJson(res, 201, { ok: true });
    const body = JSON.stringify({ ok: true });
    expect(res.writeHead).toHaveBeenCalledWith(
      201,
      expect.objectContaining({
        'Content-Length': Buffer.byteLength(body),
      }),
    );
  });

  it('handles non-2xx status codes', () => {
    const res = makeMockRes();
    sendJson(res, 404, { error: 'Not found' });
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
  });
});

describe('readBody', () => {
  it('parses a valid JSON body', async () => {
    const req = makeMockReq({ body: '{"foo":"bar"}' });
    const result = await readBody(req);
    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns an empty object for an empty body', async () => {
    const req = makeMockReq({ body: '' });
    const result = await readBody(req);
    expect(result).toEqual({});
  });

  it('rejects with an error for invalid JSON', async () => {
    const req = makeMockReq({ body: '{invalid json}' });
    await expect(readBody(req)).rejects.toThrow('Invalid JSON');
  });

  it('rejects when the body exceeds 1 MB', async () => {
    const ee = new EventEmitter() as IncomingMessage;
    ee.method = 'POST';
    ee.url = '/';
    ee.headers = {};
    (ee as any).destroy = vi.fn();

    const promise = readBody(ee);
    ee.emit('data', Buffer.alloc(1_100_000));
    await expect(promise).rejects.toThrow('too large');
  });

  it('rejects on request stream error', async () => {
    const ee = new EventEmitter() as IncomingMessage;
    ee.method = 'POST';
    ee.url = '/';
    ee.headers = {};

    const promise = readBody(ee);
    ee.emit('error', new Error('stream error'));
    await expect(promise).rejects.toThrow('stream error');
  });
});

describe('getQuery', () => {
  it('parses query string parameters', () => {
    const req = makeMockReq({
      url: '/api/v1/gts/search?speciesId=6&level=50&gender=1',
    });
    const q = getQuery(req);
    expect(q.get('speciesId')).toBe('6');
    expect(q.get('level')).toBe('50');
    expect(q.get('gender')).toBe('1');
  });

  it('returns empty URLSearchParams for a path with no query string', () => {
    const req = makeMockReq({ url: '/api/v1/gts/deposit' });
    expect(getQuery(req).toString()).toBe('');
  });
});

describe('getHeader', () => {
  it('returns the header value (case-insensitive)', () => {
    const req = makeMockReq({ headers: { 'x-player-id': 'player123' } });
    expect(getHeader(req, 'x-player-id')).toBe('player123');
    expect(getHeader(req, 'X-PLAYER-ID')).toBe('player123');
  });

  it('returns an empty string for a missing header', () => {
    const req = makeMockReq({});
    expect(getHeader(req, 'x-api-key')).toBe('');
  });

  it('returns the first value when the header is an array', () => {
    const req = makeMockReq({});
    req.headers['x-forwarded-for'] = ['1.2.3.4', '5.6.7.8'] as any;
    expect(getHeader(req, 'x-forwarded-for')).toBe('1.2.3.4');
  });
});

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  it('sets CORS headers on every request', async () => {
    router.get('/test', async (_req, res) => {
      sendJson(res, 200, {});
    });
    const req = makeMockReq({ method: 'GET', url: '/test' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      '*',
    );
  });

  it('responds 204 to OPTIONS preflight requests', async () => {
    const req = makeMockReq({ method: 'OPTIONS', url: '/anything' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(204);
  });

  it('routes a GET request to the correct handler', async () => {
    const handler = vi.fn(
      async (_req: IncomingMessage, res: ServerResponse) => {
        sendJson(res, 200, { ok: true });
      },
    );
    router.get('/api/v1/test', handler);
    const req = makeMockReq({ method: 'GET', url: '/api/v1/test' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(handler).toHaveBeenCalledOnce();
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it('routes a POST request correctly', async () => {
    const handler = vi.fn(
      async (_req: IncomingMessage, res: ServerResponse) => {
        sendJson(res, 201, { created: true });
      },
    );
    router.post('/api/v1/resource', handler);
    const req = makeMockReq({ method: 'POST', url: '/api/v1/resource' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(handler).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(201);
  });

  it('routes a DELETE request correctly', async () => {
    const handler = vi.fn(
      async (_req: IncomingMessage, res: ServerResponse) => {
        sendJson(res, 200, { deleted: true });
      },
    );
    router.delete('/api/v1/resource/:id', handler);
    const req = makeMockReq({ method: 'DELETE', url: '/api/v1/resource/abc' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('extracts named URL parameters', async () => {
    let capturedParams: Record<string, string> = {};
    router.get('/api/v1/friends/:friendCode', async (_req, res, params) => {
      capturedParams = params;
      sendJson(res, 200, {});
    });
    const req = makeMockReq({ method: 'GET', url: '/api/v1/friends/12345678' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(capturedParams.friendCode).toBe('12345678');
  });

  it('extracts multiple named URL parameters', async () => {
    let capturedParams: Record<string, string> = {};
    router.get('/api/v1/:resource/:id', async (_req, res, params) => {
      capturedParams = params;
      sendJson(res, 200, {});
    });
    const req = makeMockReq({ method: 'GET', url: '/api/v1/gts/search-99' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(capturedParams.resource).toBe('gts');
    expect(capturedParams.id).toBe('search-99');
  });

  it('URL-decodes parameter values', async () => {
    let capturedParams: Record<string, string> = {};
    router.get('/api/v1/items/:name', async (_req, res, params) => {
      capturedParams = params;
      sendJson(res, 200, {});
    });
    const req = makeMockReq({
      method: 'GET',
      url: '/api/v1/items/hello%20world',
    });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(capturedParams.name).toBe('hello world');
  });

  it('does not match a route for the wrong HTTP method', async () => {
    router.get('/api/v1/test', async (_req, res) => {
      sendJson(res, 200, {});
    });
    const req = makeMockReq({ method: 'POST', url: '/api/v1/test' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'Route not found' });
  });

  it('returns 404 when no route matches', async () => {
    const req = makeMockReq({ method: 'GET', url: '/does/not/exist' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
    expect(JSON.parse(res.body)).toMatchObject({
      error: expect.stringContaining('not found'),
    });
  });

  it('executes a middleware before the handler', async () => {
    const order: string[] = [];
    router.use(async () => {
      order.push('middleware');
      return true;
    });
    router.get('/api/v1/test', async (_req, res) => {
      order.push('handler');
      sendJson(res, 200, {});
    });
    const req = makeMockReq({ method: 'GET', url: '/api/v1/test' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(order).toEqual(['middleware', 'handler']);
  });

  it('short-circuits when a middleware returns false', async () => {
    const handler = vi.fn();
    router.use(async (_req, res) => {
      sendJson(res, 401, { error: 'Unauthorized' });
      return false;
    });
    router.get('/api/v1/test', handler);
    const req = makeMockReq({ method: 'GET', url: '/api/v1/test' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(handler).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('returns 500 when a handler throws', async () => {
    router.get('/api/v1/boom', async () => {
      throw new Error('crash');
    });
    const req = makeMockReq({ method: 'GET', url: '/api/v1/boom' });
    const res = makeMockRes();
    await router.handle(req, res);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toMatchObject({
      error: 'Internal server error',
    });
  });

  it('executes multiple middlewares in registration order', async () => {
    const order: string[] = [];
    router.use(async () => {
      order.push('mw1');
      return true;
    });
    router.use(async () => {
      order.push('mw2');
      return true;
    });
    router.get('/test', async (_req, res) => {
      order.push('handler');
      sendJson(res, 200, {});
    });
    await router.handle(
      makeMockReq({ method: 'GET', url: '/test' }),
      makeMockRes(),
    );
    expect(order).toEqual(['mw1', 'mw2', 'handler']);
  });
});
