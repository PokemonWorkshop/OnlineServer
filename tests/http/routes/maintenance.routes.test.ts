import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { Router } from '../../../src/http/router';
import { registerMaintenanceRoutes } from '../../../src/http/routes/maintenance.routes';

const mockGetStatus = vi.fn();
const mockUpdate = vi.fn();
const mockDisable = vi.fn();

vi.mock('../../../src/services/MaintenanceService', () => ({
  maintenanceService: {
    getStatus: (...a: any[]) => mockGetStatus(...a),
    update: (...a: any[]) => mockUpdate(...a),
    disable: (...a: any[]) => mockDisable(...a),
  },
}));

function makeReq(
  method: string,
  url: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = extraHeaders;

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
  registerMaintenanceRoutes(router);
  const res = makeRes();
  await router.handle(req, res);
  return { res, data: res.body ? JSON.parse(res.body) : null };
}

describe('GET /api/v1/maintenance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the current maintenance status', async () => {
    mockGetStatus.mockResolvedValue({
      enabled: true,
      message: 'Maintenance in progress',
      endAt: '2026-04-28T20:00:00.000Z',
    });

    const { res, data } = await call(makeReq('GET', '/api/v1/maintenance'));

    expect(res.statusCode).toBe(200);
    expect(data).toEqual({
      enabled: true,
      message: 'Maintenance in progress',
      endAt: '2026-04-28T20:00:00.000Z',
    });
  });
});

describe('PATCH /api/v1/maintenance/admin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the maintenance state with a valid admin key', async () => {
    mockUpdate.mockResolvedValue({
      enabled: true,
      message: 'Back soon',
      endAt: '2026-04-28T18:00:00.000Z',
    });

    const { res, data } = await call(
      makeReq(
        'PATCH',
        '/api/v1/maintenance/admin',
        {
          enabled: true,
          message: 'Back soon',
          endAt: '2026-04-28T18:00:00.000Z',
        },
        { 'x-admin-key': 'test-admin-key' },
      ),
    );

    expect(res.statusCode).toBe(200);
    expect(data.enabled).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      enabled: true,
      message: 'Back soon',
      endAt: new Date('2026-04-28T18:00:00.000Z'),
    });
  });

  it('requires a message when enabling maintenance', async () => {
    const { res, data } = await call(
      makeReq(
        'PATCH',
        '/api/v1/maintenance/admin',
        { enabled: true, endAt: '2026-04-28T18:00:00.000Z' },
        { 'x-admin-key': 'test-admin-key' },
      ),
    );

    expect(res.statusCode).toBe(400);
    expect(data.error).toBe('Invalid data');
  });

  it('returns 401 when the admin key is missing', async () => {
    const { res } = await call(
      makeReq('PATCH', '/api/v1/maintenance/admin', { enabled: false }),
    );

    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/v1/maintenance/admin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables maintenance mode', async () => {
    mockDisable.mockResolvedValue({
      enabled: false,
      message: '',
      endAt: null,
    });

    const { res, data } = await call(
      makeReq(
        'DELETE',
        '/api/v1/maintenance/admin',
        undefined,
        { 'x-admin-key': 'test-admin-key' },
      ),
    );

    expect(res.statusCode).toBe(200);
    expect(data).toEqual({ enabled: false, message: '', endAt: null });
    expect(mockDisable).toHaveBeenCalledOnce();
  });
});
