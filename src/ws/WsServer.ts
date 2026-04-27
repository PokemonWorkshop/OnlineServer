import { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyWsApiKey } from '../http/middleware';
import { telemetry } from '../telemetry/store';
import { maintenanceService } from '../services/MaintenanceService';
import { handleBattleMessage, cleanupBattle } from './handlers/battleHandler';
import { handleTradeMessage, cleanupTrade } from './handlers/tradeHandler';
import { clients } from './clients';
import { AuthenticatedWs, send } from './types';

export { clients } from './clients';

export function createWsServer(wss: WebSocketServer): void {
  wss.on('connection', async (rawWs: WebSocket, req: IncomingMessage) => {
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

    const maintenanceStatus = await maintenanceService.getStatus();
    if (maintenanceStatus.enabled) {
      send(ws, 'MAINTENANCE_STATUS', maintenanceStatus);
      rawWs.close(4004, 'Server in maintenance');
      return;
    }

    const existing = clients.get(playerId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      existing.close(4003, 'Replaced by a new connection');
    }

    clients.set(playerId, ws);
    telemetry.recordWsConnect(playerId);

    console.log(
      `[WS] connected ${ws.trainerName} (${ws.playerId}) - ${clients.size} client(s)`,
    );

    ws.on('message', async (raw) => {
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

      telemetry.recordWsMessage(type, playerId);

      if (type === 'PING') {
        send(ws, 'PONG');
        return;
      }

      if (type === 'MAINTENANCE_STATUS') {
        maintenanceService
          .getStatus()
          .then((status) => send(ws, 'MAINTENANCE_STATUS', status))
          .catch((err: Error) => {
            send(ws, 'ERROR', { message: 'Unable to load maintenance status' });
            telemetry.recordWsError(playerId, err.message);
          });
        return;
      }

      const currentMaintenance = await maintenanceService.getStatus();
      if (currentMaintenance.enabled) {
        send(ws, 'MAINTENANCE_STATUS', currentMaintenance);
        send(ws, 'ERROR', { message: 'Server is in maintenance mode' });
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

    ws.on('close', (code, reason) => {
      clients.delete(playerId);
      cleanupBattle(ws);
      cleanupTrade(ws);
      telemetry.recordWsDisconnect(playerId, code);

      console.log(
        `[WS] disconnected ${ws.trainerName} (${ws.playerId})` +
          ` - code ${code}${reason.length ? ` (${reason})` : ''}` +
          ` - ${clients.size} client(s) remaining`,
      );
    });

    ws.on('error', (err) => {
      telemetry.recordWsError(playerId, err.message);
      console.error(`[WS] Error for ${ws.trainerName} (${ws.playerId}):`, err.message);
    });
  });
}
