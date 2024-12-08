import { Socket } from 'socket.io';
import { FriendReqController } from '@ws/controllers/FriendReqController';

interface FriendReqEvents {
  friendReqAdd: (data: string) => Promise<void>;
  friendReqRemove: (data: string) => Promise<void>;
  friendReqResponse: (data: string) => Promise<void>;
  friendReqList: () => Promise<void>;
  friendReqListPending: () => Promise<void>;
}

/**
 * Class responsible for setting up and handling friendReq-related routes and events.
 */
class FriendReqRoutes {
  private friendReqController: FriendReqController;

  /**
   * Initializes the FriendReqRoutes instance.
   */
  constructor() {
    // Instantiate the FriendReqController to handle friendReq-related logic
    this.friendReqController = new FriendReqController();
    console.log('FriendReq routes have been instantiated successfully.');
  }

  /**
   * Registers event listeners for friendReq-related events on a specific socket.
   * @param socket - The Socket.IO socket instance used to communicate with the client.
   */
  public registerEvents(socket: Socket<FriendReqEvents>) {
    socket.on('friendReqAdd', (data: string) =>
      this.friendReqController.handleFriendReqAdd(socket, data)
    );
    socket.on('friendReqRemove', (data: string) =>
      this.friendReqController.handleFriendReqRemove(socket, data)
    );
    socket.on('friendReqResponse', (data: string) =>
      this.friendReqController.handleFriendReqResponse(socket, data)
    );
    socket.on('friendReqList', () =>
      this.friendReqController.handleFriendReqList(socket)
    );
    socket.on('friendReqListPending', () =>
      this.friendReqController.handleFriendReqListPending(socket)
    );
  }
}

export { FriendReqRoutes, FriendReqEvents };
