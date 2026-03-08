import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import { verifyWsApiKey } from '../http/middleware';
import { AuthenticatedWs, send } from './types';
import { handleBattleMessage, cleanupBattle } from './handlers/battleHandler';
import { handleTradeMessage, cleanupTrade } from './handlers/tradeHandler';
import { telemetry } from '../telemetry/store';

/** Global map of connected clients: playerId → socket */
export const clients = new Map<string, AuthenticatedWs>();

export function createWsServer(wss: WebSocketServer): void {
  wss.on('connection', (rawWs: WebSocket, req: IncomingMessage) => {
    // ── Authentication ─────────────────────────────────────
    const url = new URL(req.url || '/', 'http://localhost');

    const apiKey = url.searchParams.get('apiKey') ?? '';
    const playerId = url.searchParams.get('playerId') ?? '';
    const trainerName = url.searchParams.get('trainerName') ?? 'Trainer';

    if (!verifyWsApiKey(apiKey)) {
      rawWs.close(4001, 'Invalid API Key');
      return;
    }

    if (!playerId) {
      rawWs.close(4002, 'Missing playerId');
      return;
    }

    const ws = rawWs as AuthenticatedWs;
    ws.playerId = playerId;
    ws.trainerName = decodeURIComponent(trainerName);

    // Close previous session if the player reconnects
    const existing = clients.get(playerId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      existing.close(4003, 'Replaced by a new connection');
    }

    clients.set(playerId, ws);

    // ── Connection telemetry ───────────────────────────────
    telemetry.recordWsConnect(playerId);

    console.log(
      `[WS] ✅ ${ws.trainerName} (${ws.playerId}) connected — ${clients.size} client(s)`,
    );

    // ── Incoming messages ─────────────────────────────────
    ws.on('message', (raw) => {
      let type: string;
      let payload: unknown;

      try {
        const parsed = JSON.parse(raw.toString());
        type = parsed.type;
        payload = parsed.payload;
      } catch {
        send(ws, 'ERROR', { message: 'Invalid JSON message' });
        telemetry.recordWsError(playerId, 'Invalid JSON');
        return;
      }

      if (!type || typeof type !== 'string') {
        send(ws, 'ERROR', { message: 'Missing or invalid "type" field' });
        telemetry.recordWsError(playerId, 'Missing type');
        return;
      }

      // ── Message telemetry ───────────────────────────────
      telemetry.recordWsMessage(type, playerId);

      // Keepalive
      if (type === 'PING') {
        send(ws, 'PONG');
        return;
      }

      if (type.startsWith('BATTLE_')) {
        handleBattleMessage(ws, type, payload, clients);
        return;
      }

      if (type.startsWith('TRADE_')) {
        handleTradeMessage(ws, type, payload, clients);
        return;
      }

      send(ws, 'ERROR', { message: `Unknown message type: ${type}` });
      telemetry.recordWsError(playerId, `Unknown type: ${type}`);
    });

    // ── Disconnection ────────────────────────────────────
    ws.on('close', (code, reason) => {
      clients.delete(playerId);
      cleanupBattle(ws);
      cleanupTrade(ws);

      // ── Disconnection telemetry ─────────────────────────
      telemetry.recordWsDisconnect(playerId, code);

      console.log(
        `[WS] ❌ ${ws.trainerName} (${ws.playerId}) disconnected` +
          ` — code ${code}${reason.length ? ` (${reason})` : ''}` +
          ` — ${clients.size} client(s) remaining`,
      );
    });

    ws.on('error', (err) => {
      telemetry.recordWsError(playerId, err.message);
      console.error(
        `[WS] Error for ${ws.trainerName} (${ws.playerId}):`,
        err.message,
      );
    });
  });
}
