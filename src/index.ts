import 'dotenv/config';

import { HttpServer } from '@http/logic/server';
import { Server } from '@logic/server';
import { ensureToken } from '@tasks/token';
import { resolve } from 'path';
import http from 'http';
import { database_connection, database_close } from '@tasks/database'; // 👈 Ajoute database_disconnect

import './http/routes/index';
import { routes } from './http/logic/routes';
import '@tasks/logger';
import { Player } from './models/player/player.model';
import { Gift } from './models/gift/gift.model';

import '@tasks/logger';

import { JsonParser } from '@http/middlewares/jsonParser';
import { AuthMiddleware } from '@http/middlewares/authMiddleware';

const PORT = Number(process.env.SERVER_PORT) || 8080;

const rawHttpServer = http.createServer();

let httpServer: HttpServer;
let server: Server;

async function main() {
  try {
    await ensureToken(resolve('./.env'));
    await database_connection();

    httpServer = new HttpServer(PORT);
    httpServer.use(JsonParser);
    httpServer.use(AuthMiddleware);
    httpServer.useRoutes(routes);
    httpServer.attach(rawHttpServer);

    server = new Server(rawHttpServer);

    rawHttpServer.listen(PORT, () => {
      console.info(
        `HTTP + WebSocket server listening on http://localhost:${PORT}`
      );
    });

    await Player.clearExpiredPlayers(Number(process.env.DAYS_PLAYER_INACTIVE));
    await Player.clearOldFriendRequests(
      Number(process.env.DAYS_FRIEND_INACTIVE_REQUEST)
    );
    await Gift.clearExpiredGifts();

    setupGracefulShutdown();
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    console.warn(`\n[${signal}] Shutting down server...`);
    rawHttpServer.close(() => {
      console.info('HTTP server closed.');
    });

    try {
      await database_close?.();
      console.info('Database disconnected.');
    } catch (err) {
      console.error('Error during DB disconnect:', err);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    shutdown('unhandledRejection');
  });
}

main();

export { httpServer, server };
