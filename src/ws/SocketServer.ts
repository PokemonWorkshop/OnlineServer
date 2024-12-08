import { Server as SocketIOServer, Socket } from 'socket.io';
import { PlayerEvents, PlayerRoutes } from './routes/PlayerRoutes';
import { getHandshakeData, setOnlineStatus } from './services/PlayerServices';
import { FriendReqEvents, FriendReqRoutes } from './routes/FriendReqRoutes';
import { GtsEvents, GtsRoutes } from './routes/GtsRoutes';
import { GiftEvents, GiftRoutes } from './routes/GiftRoutes';
import KoaServer from '../api/KoaServer';

export interface SocketServerOptions {
  port: number;
  host: string;
  corsOrigin?: string;
  corsMethods?: string[];
}

/**
 * Server class responsible for handling the Socket.IO server and managing
 * player connections, disconnections, and event routing for gifts, players, and friend requests.
 */
class SocketServer {
  private io: SocketIOServer;
  private giftRoutes: GiftRoutes;
  private playerRoutes: PlayerRoutes;
  private friendReqRoutes: FriendReqRoutes;
  private gtsRoutes: GtsRoutes;

  /**
   * Initializes the Socket.IO server with provided options and sets up event routes.
   *
   * @param {ServerOptions} options - Server configuration options such as port and CORS settings.
   */
  constructor(options: SocketServerOptions) {
    this.io = new SocketIOServer({
      pingInterval: 25000,
      pingTimeout: 60000,
      allowEIO3: true,
      transports: ['websocket'],
      cors: {
        origin: options.corsOrigin || '*',
        methods: options.corsMethods || ['GET'],
      },
    });

    this.giftRoutes = new GiftRoutes();
    this.playerRoutes = new PlayerRoutes();
    this.friendReqRoutes = new FriendReqRoutes();
    this.gtsRoutes = new GtsRoutes();

    try {
      this.io.listen(options.port);
      console.log(
        `Socket is running on http://${options.host}:${options.port}`
      );
    } catch (error) {
      console.log(error);
    }

    this.handleSocketConnection();
    this.handleProcessShutdown();
  }

  /**
   * Handles socket connections, sets up event handlers, and manages online status.
   */
  private handleSocketConnection(): void {
    this.io.on('connection', async (socket: Socket) => {
      console.info(`User connected - ID: ${socket.id}`);

      try {
        const { playerId } = await getHandshakeData(socket, true);

        this.registerEventHandlers(socket);

        await setOnlineStatus(playerId, true);

        socket.on('disconnect', async () => {
          console.info(`User disconnected - ID: ${socket.id}`);
          await setOnlineStatus(playerId, false);
        });
      } catch (error) {
        console.error(`Error processing connection: ${error}`);
        socket.disconnect();
      }
    });
  }

  /**
   * Handles system signals for graceful shutdown and notifies all clients.
   */
  private handleProcessShutdown(): void {
    const broadcastShutdown = () => {
      console.log('Broadcasting shutdown to all connected clients...');
      this.io.emit('server_shutdown', {
        message: 'The server is shutting down',
      });
    };

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing server gracefully...');
      broadcastShutdown();

      setTimeout(() => {
        this.io.close(() => {
          console.log('Socket.IO server closed.');
          KoaServer.stop();
          process.exit(0);
        });
      }, 5000);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing server gracefully...');
      broadcastShutdown();

      setTimeout(() => {
        this.io.close(() => {
          console.log('Socket.IO server closed.');
          KoaServer.stop();
          process.exit(0);
        });
      }, 5000);
    });
  }

  /**
   * Registers event handlers for different routes associated with the socket.
   *
   * @param socket - The socket instance to register events for.
   */
  private registerEventHandlers(socket: Socket): void {
    this.giftRoutes.registerEvents(socket as Socket<GiftEvents>);
    this.playerRoutes.registerEvents(socket as Socket<PlayerEvents>);
    this.friendReqRoutes.registerEvents(socket as Socket<FriendReqEvents>);
    this.gtsRoutes.registerEvents(socket as Socket<GtsEvents>);
  }
}

export default SocketServer;
