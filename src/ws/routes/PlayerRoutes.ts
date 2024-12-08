import { Socket } from 'socket.io';
import { PlayerController } from '@ws/controllers/PlayerController';

interface PlayerEvents {
  playerCreate: (data: unknown) => Promise<void>;
  playerDelete: () => Promise<void>;
}

/**
 * Class responsible for setting up and handling player-related routes and events.
 */
class PlayerRoutes {
  private playerController: PlayerController;

  /**
   * Initializes the PlayerRoutes instance.
   */
  constructor() {
    // Instantiate the PlayerController to handle player-related logic
    this.playerController = new PlayerController();
    console.log('Player routes have been instantiated successfully.');
  }

  /**
   * Registers event listeners for player-related events on a specific socket.
   * @param socket - The Socket.IO socket instance used to communicate with the client.
   */
  public registerEvents(socket: Socket<PlayerEvents>) {
    socket.on('playerCreate', (data: unknown) =>
      this.playerController.handlePlayerCreate(socket, data)
    );

    socket.on('playerDelete', () =>
      this.playerController.handlePlayerDelete(socket)
    );
  }
}

export { PlayerRoutes, PlayerEvents };
