import { WebSocketServer, WebSocket, Data } from 'ws';
import {
  EventHandler,
  EventHandlers,
  EventData,
  EventResponse,
  LatencyData,
} from '@src/types';
import events from '@events/index';
import { verify } from 'jsonwebtoken';
import { Player } from '@root/src/models/player';
import { Server as HttpNodeServer } from 'http';
import { removeSessionByPlayer, getPartner } from './tradeSession';

const SECRET_KEY = process.env.SECRET_KEY as string;

const PING_LATENCY = 10000; // 10 seconds

/**
 * The OServer class provides a WebSocket server implementation that allows
 * for handling connections, registering event handlers, emitting events to
 * specific clients, and broadcasting events to all connected clients.
 *
 * @remarks
 * This class uses the `ws` library to create and manage WebSocket connections.
 *
 * @example
 * ```typescript
 * const server = new Server(8080);
 *
 * server.on('greet', (data, ws) => {
 *   console.log(`Received greeting: ${data}`);
 *   server.emit(ws, 'response', 'Hello, client!');
 * });
 *
 * server.broadcast('announcement', 'Server is live!');
 * ```
 *
 * @public
 * @author Ota
 */
export class Server {
  private wss: WebSocketServer;
  private eventHandlers: EventHandlers;
  private clients: Map<string, WebSocket> = new Map();
  private latencies: Map<string, LatencyData> = new Map();

  /**
   * Creates an instance of the WebSocket server and sets up event listeners for client connections.
   *
   * @param port - The port number on which the WebSocket server will listen.
   *
   * The constructor initializes a new WebSocketServer instance with the specified port.
   *
   * Additionally, it logs a message indicating that the WebSocket server has started and is listening on the specified port.
   */
  constructor(httpServer: HttpNodeServer) {
    this.wss = new WebSocketServer({ server: httpServer });
    this.eventHandlers = events;

    this.wss.on('connection', async (ws, request) => {
      const token = request.headers['authorization'] as string;

      try {
        verify(token, SECRET_KEY);

        if (token !== process.env.TOKEN_SERVER) {
          return this.rejectConnection(
            ws,
            'ERR_VALID_TOKEN',
            'Access denied. The token is no longer valid.'
          );
        }
      } catch (error) {
        return this.rejectConnection(
          ws,
          'ERR_MISSING_TOKEN',
          'Missing authentication token'
        );
      }

      const playerId = request.headers['player-id'] as string;
      const playerName = (request.headers['player-name'] as string) || playerId;

      if (!playerId) {
        return this.rejectConnection(ws, 'ERR_MISSING_PLAYER_ID', 'Missing player_id in connection request');
      }

      // If player is already connected (stale connection from crash/restart), close the old one
      if (this.clients.has(playerId)) {
        const oldWs = this.clients.get(playerId);
        console.log(`Player ${playerId} reconnecting — closing stale connection`);
        this.clients.delete(playerId);
        try { oldWs?.close(); } catch { /* ignore */ }
      }

      this.clients.set(playerId, ws);
      console.log(`Player ${playerId} connected`);

      try {
        await Player.setPlayerConnectionStatus(playerId, true);
      } catch {
        // Player might not exist yet, that's fine
      }

      // Ensure player exists (auto-create on first connection), then send data
      try {
        const result = await Player.ensurePlayer({ id: playerId, name: playerName });
        console.log('ensurePlayer result:', JSON.stringify(result));
      } catch (err: any) {
        console.error('Error ensuring player:', err?.message || err?.stack || String(err));
      }
      // Sync player name from header if it differs from DB (trainer may have changed name)
      if (playerName && playerName !== playerId) {
        try {
          await Player.updateFields(playerId, { name: playerName });
        } catch {
          // Non-critical, ignore
        }
      }
      const playerData = await Player.findOne({ id: playerId });
      if (playerData) {
        this.emit(ws, 'authenticated', {
          event: 'authenticated',
          player: {
            id: playerData.id,
            name: playerData.name,
            friendCode: playerData.friendCode,
            greeting: playerData.greeting,
            charsetBase: playerData.charsetBase,
            trades: playerData.trades,
            wins: playerData.wins,
            losses: playerData.losses,
          },
          friendCode: playerData.friendCode,
        });

        // Notify online friends that this player is now online
        for (const friendId of playerData.friends) {
          const friendWs = this.clients.get(friendId);
          if (friendWs && friendWs.readyState === WebSocket.OPEN) {
            this.emit(friendWs, 'friendOnline', { friendId: playerId });
          }
        }
      }

      ws.on('message', (message) => this.handleMessage(message, ws));

      ws.on('close', async () => {
        for (const [id, client] of this.clients.entries()) {
          if (client === ws) {
            this.clients.delete(id);
            console.log(`Player ${id} disconnected`);
            await Player.setPlayerConnectionStatus(playerId, false);

            // Cancel active trade session on disconnect
            const tradeSession = removeSessionByPlayer(playerId);
            if (tradeSession) {
              const partnerId = getPartner(tradeSession, playerId);
              if (partnerId) {
                const partnerWs = this.clients.get(partnerId);
                if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
                  this.emit(partnerWs, 'tradeCancelled', {
                    cancelledBy: playerId,
                  });
                }
              }
            }

            // Notify online friends that this player is now offline
            const disconnectedPlayer = await Player.findOne({ id: playerId });
            if (disconnectedPlayer) {
              for (const friendId of disconnectedPlayer.friends) {
                const friendWs = this.clients.get(friendId);
                if (friendWs && friendWs.readyState === WebSocket.OPEN) {
                  this.emit(friendWs, 'friendOffline', { friendId: playerId });
                }
              }
            }

            break;
          }
        }
      });
    });
  }

  /**
   * Registers an event handler for a specific event.
   *
   * @param event - The name of the event to listen for.
   * @param handler - The function to handle the event when it is triggered.
   */
  public on(event: string, handler: EventHandler): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Emits an event to the specified WebSocket connection.
   *
   * @param ws - The WebSocket connection to send the event to.
   * @param event - The name of the event to emit.
   * @param data - The data to send with the event.
   */
  public emit(ws: WebSocket, event: string, data: EventResponse): void {
    ws.send(JSON.stringify({ event, data }));
  }

  /**
   * Broadcasts an event with the given data to all connected WebSocket clients.
   *
   * @param event - The name of the event to broadcast.
   * @param data - The data to send with the event.
   */
  public broadcast(event: string, data: EventResponse): void {
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ event, data }));
      }
    }
  }

  /**
   * Retrieves the client ID associated with the given WebSocket instance.
   *
   * @param ws - The WebSocket instance to search for.
   * @returns The client ID if found, otherwise `undefined`.
   */
  public getClientId(ws: WebSocket): string | undefined {
    for (const [id, client] of this.clients.entries()) {
      if (client === ws) {
        return id;
      }
    }

    return undefined;
  }

  /**
   * Retrieves the WebSocket connection associated with a given player ID.
   *
   * @param playerId - The unique identifier of the player.
   * @returns The WebSocket connection for the specified player, or `undefined` if no connection exists.
   */
  public getClientWebsocket(playerId: string): WebSocket | undefined {
    return this.clients.get(playerId);
  }

  /**
   * Gets the number of connected clients.
   *
   * @returns {number} The current number of clients connected to the server.
   */
  get clientsCount(): number {
    return this.clients.size;
  }

  /**
   * Gets the IDs of all connected clients.
   *
   * @returns {string[]} An array of client IDs.
   */
  get clientsIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Checks if a given player ID is already present in the clients map.
   *
   * @param playerId - The unique identifier of the player to check.
   * @returns {boolean} `true` if the player ID is not present, `false` otherwise.
   */
  public isClientIdAvailable(playerId: string): boolean {
    return !this.clients.has(playerId);
  }

  /**
   * Gets the list of WebSocket clients connected to the server.
   *
   * @returns {WebSocket[]} An array of WebSocket instances representing the connected clients.
   */
  get clientsWebsockets(): WebSocket[] {
    return Array.from(this.clients.values());
  }

  /**
   * Associates a WebSocket connection with a specific player ID.
   *
   * @param playerId - The unique identifier of the player.
   * @param ws - The WebSocket instance to be associated with the player.
   * @returns void
   */
  public setClientsWebsocket(playerId: string, ws: WebSocket): void {
    this.clients.set(playerId, ws);
  }

  /**
   * Handles incoming WebSocket messages by parsing the message and delegating
   * the event handling to the appropriate handler.
   *
   * @param message - The incoming message data from the WebSocket.
   * @param ws - The WebSocket connection instance.
   *
   * @throws Will log an error if the message format is invalid.
   */
  private handleMessage(message: Data, ws: WebSocket): void {
    try {
      const { event, data } = JSON.parse(message.toString());

      this.handleEvent(event, data, ws);
    } catch (error) {
      console.error('Invalid message format', error);
    }
  }

  /**
   * Handles incoming events from a WebSocket connection.
   *
   * @param event - The name of the event to handle.
   * @param data - The data associated with the event.
   * @param ws - The WebSocket instance associated with the client.
   * @returns A promise that resolves when the event handling is complete.
   *
   * @remarks
   * This method identifies the player associated with the WebSocket connection
   * and invokes the corresponding event handler if one exists. It also measures
   * and logs the latency for the event handling process. If no handler is found
   * for the event, a warning is logged. Errors during event handling are caught
   * and logged.
   *
   * @throws Will log an error if the event handler throws an exception.
   */
  private async handleEvent(
    event: string,
    data: EventData,
    ws: WebSocket
  ): Promise<void> {
    const playerId = this.getClientId(ws);
    if (!playerId) {
      console.warn('Player ID not found for the WebSocket connection');
      return;
    }

    const start = Date.now();

    const handler = this.eventHandlers[event];

    if (handler) {
      try {
        await handler(data, ws);
        const latency = Date.now() - start;
        this.latencies.set(playerId, {
          lastPing: Date.now(),
          latency,
        });
      } catch (error) {
        console.error(`Error handling event ${event}:`, error);
      }
    } else {
      console.warn(`No handler for event: ${event}`);
    }
  }

  /**
   * Rejects a WebSocket connection by sending an error message and closing the connection.
   *
   * @param ws - The WebSocket instance representing the connection to be rejected.
   * @param code - A string representing the error code to be sent to the client.
   * @param message - A string containing the error message to be sent to the client.
   */
  private rejectConnection(ws: WebSocket, code: string, message: string): void {
    ws.send(JSON.stringify({ event: 'error', data: { error: code, message } }));
    ws.close();
  }

  /**
   * Calculates the global average latency based on the stored latency values.
   *
   * @returns {number | null} The average latency if there are valid latency values,
   *                          or `null` if no valid latencies are available.
   */
  public getGlobalLatency(): number | null {
    const latencies = Array.from(this.latencies.values())
      .map((data) => data.latency)
      .filter((latency) => latency > 0);
    if (latencies.length === 0) return null;
    const totalLatency = latencies.reduce((acc, latency) => acc + latency, 0);
    return totalLatency / latencies.length;
  }
}
