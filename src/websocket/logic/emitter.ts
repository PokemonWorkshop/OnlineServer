import { WebSocketServer, WebSocket } from 'ws';
import { EventResponse } from '@src/types';

/**
 * Emits an event to the specified WebSocket connection.
 *
 * @param ws - The WebSocket connection to send the event to.
 * @param event - The name of the event to emit.
 * @param data - The data to send with the event.
 */
export function emit(ws: WebSocket, event: string, data: EventResponse): void {
  ws.send(JSON.stringify({ event, data }));
}

/**
 * Emits an error event to the specified WebSocket connection.
 *
 * @param ws - The WebSocket connection to send the error event to.
 * @param code - The error code to send.
 * @param message - The error message to send.
 */
export function emitError(ws: WebSocket, code: string, message?: string): void {
  emit(ws, 'error', { error: code, message });
}

/**
 * Broadcasts an event with the given data to all connected WebSocket clients.
 *
 * @param wss - The WebSocketServer to broadcast the event to.
 * @param event - The name of the event to broadcast.
 * @param data - The data to send with the event.
 */
export function broadcast(
  wss: WebSocketServer,
  event: string,
  data: EventResponse
): void {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }
}


