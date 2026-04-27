import { WebSocket } from 'ws';

/**
 * Authenticated WebSocket enriched with player metadata after the WS handshake.
 */
export interface AuthenticatedWs extends WebSocket {
  playerId: string;
  trainerName: string;
  roomId?: string;
}

/**
 * All WebSocket message type literals exchanged between clients and server.
 */
export type WsMessageType =
  | 'BATTLE_CHALLENGE'
  | 'BATTLE_ACCEPT'
  | 'BATTLE_DECLINE'
  | 'BATTLE_ACTION'
  | 'BATTLE_STATE'
  | 'BATTLE_END'
  | 'TRADE_REQUEST'
  | 'TRADE_ACCEPT'
  | 'TRADE_DECLINE'
  | 'TRADE_OFFER'
  | 'TRADE_CONFIRM'
  | 'TRADE_CANCEL'
  | 'TRADE_COMPLETE'
  | 'MAINTENANCE_STATUS'
  | 'PING'
  | 'PONG'
  | 'ERROR';

export interface WsMessage {
  type: WsMessageType;
  payload?: unknown;
}

/**
 * Sends a JSON-encoded message to a socket only if the connection is open.
 */
export function send(ws: WebSocket, type: WsMessageType, payload?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload } satisfies WsMessage));
  }
}
