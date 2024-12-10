import { Socket } from 'socket.io';
import { GiftController } from '@ws/controllers/GiftController';

interface GiftEvents {
  giftClaim: (data: unknown) => Promise<void>;
  giftList: () => Promise<void>;
}

/**
 * Class responsible for setting up and handling gift-related routes and events.
 */
class GiftRoutes {
  private giftController: GiftController;

  /**
   * Initializes the GiftRoutes instance.
   * Creates an instance of GiftController to manage gift-related operations.
   */
  constructor() {
    this.giftController = new GiftController();
    console.log('Gift routes have been instantiated successfully.');
  }

  /**
   * Registers event listeners for gift-related events on a specific socket.
   * Sets up the handlers for various events that involve gift operations.
   * @param socket - The Socket.IO socket instance used to communicate with the client.
   * This socket will listen for gift-related events and delegate the handling to GiftController.
   */
  public registerEvents(socket: Socket<GiftEvents>) {
    socket.on('giftClaim', (data: unknown) =>
      this.giftController.handleGiftClaim(socket, data)
    );
    socket.on('giftList', () => this.giftController.handleGiftList(socket));
  }
}

export { GiftRoutes, GiftEvents };
