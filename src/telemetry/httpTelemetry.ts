import { IncomingMessage, ServerResponse } from 'node:http';
import { telemetry } from './store';

/**
 * Routes excluded from telemetry tracking — they would distort business stats.
 * /telemetry* : dashboard + its API endpoints (auto-refresh every 10s)
 * /health      : health check (pinged by load balancers, uptime monitors…)
 * /favicon.ico : static asset
 */
/** Routes excluded from telemetry stats (but still logged to console/file). */
const TELEMETRY_EXCLUDED = ['/telemetry', '/health', '/favicon.ico'];

export async function httpTelemetryMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const pathname = parsePathname(req.url || '/');
  const method   = req.method || 'GET';
  const start    = Date.now();

  const originalWriteHead = res.writeHead.bind(res);

  res.writeHead = function (statusCode: number, ...args: unknown[]) {
    const ms = Date.now() - start;

    // Always log every request — telemetry exclusions don't affect console/file logs
    const statusColor = statusCode >= 500 ? '\x1b[31m'
                      : statusCode >= 400 ? '\x1b[33m'
                      : statusCode >= 300 ? '\x1b[36m'
                      :                    '\x1b[32m';
    const reset = '\x1b[0m';
    console.debug('HTTP', `${method} ${pathname} ${statusColor}${statusCode}${reset} — ${ms}ms`);

    // Only feed telemetry stats for non-excluded routes
    if (!TELEMETRY_EXCLUDED.some((p) => pathname.startsWith(p))) {
      telemetry.recordHttp(method, pathname, statusCode, ms);
    }

    // @ts-ignore
    return originalWriteHead(statusCode, ...args);
  };

  return true;
}

/**
 * Safely parses pathname from a URL string.
 */
function parsePathname(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '/';
  }
}
