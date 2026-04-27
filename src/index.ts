import 'dotenv/config';
import './logger';
import http from 'node:http';
import { WebSocketServer } from 'ws';

import { connectDatabase } from './config/database';
import { ENV } from './config/env';
import { Router, sendJson } from './http/router';
import { apiKeyMiddleware, maintenanceModeMiddleware } from './http/middleware';
import { registerAuthRoutes } from './http/routes/auth.routes';
import { registerGtsRoutes } from './http/routes/gts.routes';
import { registerMysteryGiftRoutes } from './http/routes/mysteryGift.routes';
import { registerFriendRoutes } from './http/routes/friends.routes';
import { registerMaintenanceRoutes } from './http/routes/maintenance.routes';
import { registerTelemetryRoutes } from './http/routes/telemetry.routes';
import { openApiSpec, swaggerUiHtml } from './swagger';
import { createWsServer } from './ws/WsServer';
import { telemetry } from './telemetry/store';
import { httpTelemetryMiddleware } from './telemetry/httpTelemetry';
import { installDbTelemetry } from './telemetry/dbTelemetry';
import {
  startTelemetryPersist,
  stopTelemetryPersist,
  restoreTelemetryFromDb,
  flushTelemetryToDb,
} from './telemetry/persist';

async function bootstrap(): Promise<void> {
  // ── Database ───────────────────────────────────────────
  await connectDatabase();

  // ── DB Telemetry (Mongoose plugin — before any model) ──
  installDbTelemetry();

  // ── Restore snapshots from MongoDB ────────────────────
  await restoreTelemetryFromDb();

  // ── Capture unhandled errors ──────────────────────────
  process.on('uncaughtException', (err) => {
    telemetry.recordError('uncaughtException', err.message);
    console.error('[Fatal] uncaughtException:', err);
  });
  process.on('unhandledRejection', (reason) => {
    telemetry.recordError('unhandledRejection', String(reason));
    console.error('[Fatal] unhandledRejection:', reason);
  });

  // ── Native HTTP router ─────────────────────────────────
  const router = new Router();

  // Middleware 1: HTTP telemetry (before apiKey to capture everything)
  router.use(httpTelemetryMiddleware);

  // Middleware 2: API Key
  router.use(apiKeyMiddleware);

  // Middleware 3: maintenance gate for player-facing routes
  router.use(maintenanceModeMiddleware);

  // Register routes
  registerAuthRoutes(router);
  registerGtsRoutes(router);
  registerMysteryGiftRoutes(router);
  registerFriendRoutes(router);
  registerMaintenanceRoutes(router);
  registerTelemetryRoutes(router);

  // ── Native THTP server ────────────────────────────────
  const server = http.createServer((req, res) => {
    const method = req.method || 'GET';
    const pathname = (req.url || '/').split('?')[0];
    const start = Date.now();

    // Helper: log + send for routes handled before the router middleware
    const earlyRespond = (status: number, send: () => void) => {
      send();
      const ms = Date.now() - start;
      const statusColor =
        status >= 500
          ? '\x1b[31m'
          : status >= 400
            ? '\x1b[33m'
            : status >= 300
              ? '\x1b[36m'
              : '\x1b[32m';
      console.debug(
        'HTTP',
        `${method} ${pathname} ${statusColor}${status}\x1b[0m — ${ms}ms`,
      );
    };

    // Public health check (no API Key)
    if (pathname === '/health' && method === 'GET') {
      earlyRespond(200, () =>
        sendJson(res, 200, {
          status: 'ok',
          uptime: Math.floor(process.uptime()),
        }),
      );
      return;
    }

    // Swagger UI
    if (pathname === '/api-docs' && method === 'GET') {
      earlyRespond(200, () => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(swaggerUiHtml());
      });
      return;
    }

    // OpenAPI JSON spec
    if (pathname === '/api-docs/openapi.json' && method === 'GET') {
      earlyRespond(200, () => {
        const body = JSON.stringify(openApiSpec, null, 2);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
        });
        res.end(body);
      });
      return;
    }

    // Silence favicon requests — but still log them
    if (pathname === '/favicon.ico') {
      earlyRespond(204, () => {
        res.writeHead(204);
        res.end();
      });
      return;
    }

    router.handle(req, res).catch((err) => {
      telemetry.recordError('HTTP', err.message ?? String(err));
      console.error('[HTTP] Unhandled error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    });
  });

  // ── WebSocket (same port, path /ws) ───────────────────
  const wss = new WebSocketServer({ server, path: '/ws' });
  createWsServer(wss);

  // ── Telemetry persistence ─────────────────────────────
  startTelemetryPersist();

  // ── Start server ─────────────────────────────────────
  server.listen(ENV.PORT, () => {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║         PSDK Online Server — Started              ║');
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log(`║  HTTP      →  http://localhost:${ENV.PORT}/api/v1        ║`);
    console.log(`║  WS        →  ws://localhost:${ENV.PORT}/ws              ║`);
    console.log(`║  Swagger   →  http://localhost:${ENV.PORT}/api-docs      ║`);
    console.log(`║  Telemetry →  http://localhost:${ENV.PORT}/telemetry     ║`);
    console.log(`║  Mode      →  ${ENV.NODE_ENV.padEnd(34)}  ║`);
    console.log('╚═══════════════════════════════════════════════════╝\n');
  });

  // ── Graceful shutdown ────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
    stopTelemetryPersist();
    await flushTelemetryToDb(); // final flush before exit
    wss.close();
    server.close(() => {
      console.log('[Server] Server stopped');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Fatal] Startup error:', err);
  process.exit(1);
});
