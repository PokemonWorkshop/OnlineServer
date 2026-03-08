import { IncomingMessage, ServerResponse } from 'node:http';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Route handler function signature.
 *
 * @param req    - Incoming HTTP request.
 * @param res    - Server response.
 * @param params - Named URL parameters extracted from the route pattern (e.g. `{ id: "abc" }`).
 */
export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
) => Promise<void>;

/**
 * Middleware function signature.
 *
 * @param req - Incoming HTTP request.
 * @param res - Server response.
 * @returns `true` to continue the chain, `false` to short-circuit (response already sent).
 */
export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<boolean>;

/** Internal route descriptor built from a path pattern string. */
interface Route {
  method:     string;
  pattern:    RegExp;
  paramNames: string[];
  handler:    Handler;
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Minimal HTTP router built on top of Node's native `http` module.
 *
 * @remarks
 * Supports named URL parameters (`:param`), global middleware, CORS preflight,
 * and structured JSON error responses. No third-party runtime dependency.
 *
 * Middleware execution order matches registration order. The first middleware
 * that returns `false` stops the chain — subsequent middlewares and the handler
 * are **not** called.
 *
 * @example
 * ```ts
 * const router = new Router();
 * router.use(apiKeyMiddleware);
 * router.get('/api/v1/players/:id', async (req, res, { id }) => {
 *   sendJson(res, 200, { id });
 * });
 * server.on('request', (req, res) => router.handle(req, res));
 * ```
 */
export class Router {
  private readonly routes:      Route[]      = [];
  private readonly middlewares: Middleware[] = [];

  /**
   * Registers a global middleware.
   *
   * @param fn - Middleware to append to the execution chain.
   */
  use(fn: Middleware): void {
    this.middlewares.push(fn);
  }

  /** @internal Compiles a path string into a `Route` descriptor. */
  private add(method: string, path: string, handler: Handler): void {
    const paramNames: string[] = [];
    const regexStr = path.replace(/:([a-zA-Z_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({ method, pattern: new RegExp(`^${regexStr}$`), paramNames, handler });
  }

  /**
   * Registers a `GET` route.
   * @param path    - Express-style path with optional `:param` segments.
   * @param handler - Async handler function.
   */
  get(path: string, handler: Handler): void    { this.add('GET',    path, handler); }

  /**
   * Registers a `POST` route.
   * @param path    - Express-style path with optional `:param` segments.
   * @param handler - Async handler function.
   */
  post(path: string, handler: Handler): void   { this.add('POST',   path, handler); }

  /**
   * Registers a `DELETE` route.
   * @param path    - Express-style path with optional `:param` segments.
   * @param handler - Async handler function.
   */
  delete(path: string, handler: Handler): void { this.add('DELETE', path, handler); }

  /**
   * Dispatches an incoming request through middlewares then the matching route.
   *
   * @remarks
   * Automatically handles CORS headers and `OPTIONS` preflight.
   * Responds `404` if no route matches.
   *
   * @param req - Incoming HTTP request.
   * @param res - Server response.
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-player-id');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Run middlewares in order
    for (const mw of this.middlewares) {
      const next = await mw(req, res);
      if (!next) return;
    }

    const pathname = parsePathname(req.url || '/');
    const method   = req.method || 'GET';

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });

      try {
        await route.handler(req, res, params);
      } catch (err) {
        console.error('[Router] Unhandled error:', err);
        sendJson(res, 500, { error: 'Internal server error' });
      }
      return;
    }

    // 404 — also tracked by telemetry if available
    try {
      const { telemetry } = await import('../telemetry/store');
      const start = (res as any)._telStart ?? Date.now();
      telemetry.recordHttp(method, pathname, 404, Date.now() - start);
    } catch {}

    sendJson(res, 404, { error: 'Route not found' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Serialises `data` as JSON and writes the HTTP response.
 *
 * @param res    - Server response to write to.
 * @param status - HTTP status code.
 * @param data   - Any JSON-serialisable value.
 */
export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Reads and parses the request body as JSON.
 *
 * @param req - Incoming HTTP request.
 * @returns Parsed body cast to `T`.
 * @throws {Error} If the body exceeds 1 MB or contains invalid JSON.
 *
 * @typeParam T - Expected shape of the parsed body.
 */
export async function readBody<T = unknown>(req: IncomingMessage): Promise<T> {
  const MAX_BODY = 1_000_000; // 1 MB

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : ({} as T));
      } catch {
        reject(new Error('Invalid JSON request body'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Returns the query string parameters of a request as a `URLSearchParams` instance.
 *
 * @param req - Incoming HTTP request.
 * @returns Parsed query parameters.
 */
export function getQuery(req: IncomingMessage): URLSearchParams {
  return new URL(req.url || '/', 'http://localhost').searchParams;
}

/**
 * Reads a single request header, normalising the name to lower-case.
 * Returns an empty string if the header is absent.
 *
 * @param req  - Incoming HTTP request.
 * @param name - Header name (case-insensitive).
 */
export function getHeader(req: IncomingMessage, name: string): string {
  const val = req.headers[name.toLowerCase()];
  return Array.isArray(val) ? val[0] : (val ?? '');
}

/** @internal Extracts the pathname from a raw URL string. */
function parsePathname(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '/';
  }
}
