import { IncomingMessage, ServerResponse } from 'node:http';
import { ENV } from '../config/env';
import { sendJson, getHeader } from './router';
import { maintenanceService } from '../services/MaintenanceService';

// Augment the native type so `playerId` can travel through the request lifecycle.
declare module 'node:http' {
  interface IncomingMessage {
    /** Player ID extracted from the `x-player-id` header by {@link extractPlayer}. */
    playerId?: string;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Global API-key middleware — gate for every HTTP route except the telemetry
 * dashboard (`/telemetry`), which prompts the key via browser JavaScript.
 *
 * @remarks
 * The key must be passed as the `x-api-key` request header.
 * It is compared against `ENV.API_KEY` using strict equality.
 *
 * Register this **after** {@link httpTelemetryMiddleware} so that rejected
 * requests are still captured in telemetry stats.
 *
 * @returns `true` to continue the middleware chain, `false` if the key is
 *   invalid (a `401` response is already sent).
 */
export async function apiKeyMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = (req.url || '/').split('?')[0];

  // Dashboard HTML loads without any key — the JS page prompts for ADMIN_KEY.
  if (pathname === '/telemetry') return true;

  // Admin routes (/telemetry/* and /mystery-gift/admin/*) accept x-admin-key
  // directly, so callers don't need to send both keys at once.
  // requireAdmin() inside the route handler will validate the key itself.
  const isAdminRoute =
    pathname.startsWith('/telemetry/') ||
    pathname.startsWith('/api/v1/mystery-gift/admin') ||
    pathname.startsWith('/api/v1/maintenance/admin');
  if (isAdminRoute) {
    const adminKey = getHeader(req, 'x-admin-key');
    if (adminKey && adminKey === ENV.ADMIN_KEY) return true;
    // No valid admin key — fall through to the regular API_KEY check so the
    // error message stays consistent (requireAdmin will 401 again inside the handler).
  }

  const key = getHeader(req, 'x-api-key');
  if (!key || key !== ENV.API_KEY) {
    sendJson(res, 401, { error: 'Invalid or missing API Key' });
    return false;
  }
  return true;
}

/**
 * Blocks player-facing HTTP routes while maintenance mode is enabled.
 *
 * @remarks
 * Admin maintenance routes remain available so the mode can be disabled again.
 * The public health check and docs are handled outside the router.
 */
export async function maintenanceModeMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = (req.url || '/').split('?')[0];

  const isAllowedDuringMaintenance =
    pathname === '/api/v1/maintenance' ||
    pathname.startsWith('/api/v1/maintenance/admin') ||
    pathname === '/telemetry' ||
    pathname.startsWith('/telemetry/');

  if (isAllowedDuringMaintenance) return true;

  const status = await maintenanceService.getStatus();
  if (!status.enabled) return true;

  sendJson(res, 503, {
    error: 503,
    maintenance: status,
  });
  return false;
}

// ─── Guards ───────────────────────────────────────────────────────────────────

/**
 * Inline player guard — extracts the `x-player-id` header and attaches it
 * to `req.playerId`.
 *
 * @remarks
 * Call this at the **top** of any route handler that requires player identity.
 * It is intentionally NOT a middleware so handlers can choose to skip it.
 *
 * The `playerId` is the game-side identifier — it is never validated against
 * the database here; that responsibility belongs to the service layer.
 *
 * @returns `true` if the header is present and non-empty, `false` otherwise
 *   (a `400` response is already sent).
 *
 * @example
 * ```ts
 * router.get('/api/v1/gts/deposit', async (req, res) => {
 *   if (!extractPlayer(req, res)) return;
 *   const deposit = await gtsService.getMyDeposit(req.playerId!);
 *   sendJson(res, 200, deposit ?? null);
 * });
 * ```
 */
export function extractPlayer(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const id = getHeader(req, 'x-player-id');
  if (!id || id.trim() === '') {
    sendJson(res, 400, { error: 'Missing X-Player-Id header' });
    return false;
  }
  req.playerId = id.trim();
  return true;
}


/**
 * Inline admin guard — verifies the `x-admin-key` header against `ENV.ADMIN_KEY`.
 *
 * @remarks
 * Use this at the top of any handler that requires admin privileges:
 * telemetry data endpoints and mystery-gift admin routes.
 * It is intentionally NOT a middleware so it can be applied per-route.
 *
 * @returns `true` if the key is valid, `false` otherwise
 *   (a `401` response is already sent).
 *
 * @example
 * ```ts
 * router.get('/telemetry/summary', async (req, res) => {
 *   if (!requireAdmin(req, res)) return;
 *   sendJson(res, 200, telemetry.getSummary());
 * });
 * ```
 */
export function requireAdmin(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const key = getHeader(req, 'x-admin-key');
  if (!key || key !== ENV.ADMIN_KEY) {
    sendJson(res, 401, { error: 'Invalid or missing Admin Key' });
    return false;
  }
  return true;
}

/**
 * Verifies the API key for WebSocket connections.
 *
 * @remarks
 * WebSocket clients pass the key as a query param (`?apiKey=…`) because
 * browsers do not support custom headers on the initial WS handshake.
 *
 * @param key - The value of the `apiKey` query parameter.
 * @returns `true` if the key matches `ENV.API_KEY`.
 */
export function verifyWsApiKey(key: string): boolean {
  return key === ENV.API_KEY;
}
