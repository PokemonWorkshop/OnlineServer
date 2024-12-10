import { Socket } from 'socket.io';
import { friendReqAdd } from './friendReq/friendReqAdd';
import { friendReqResponse } from './friendReq/friendReqResponse';
import { friendReqList } from './friendReq/friendReqList';
import { friendReqRemove } from './friendReq/friendReqRemove';
import { friendReqListPending } from './friendReq/friendReqListPending';

/**
 * Controller class responsible for managing operations related to friend requests.
 */
export class FriendReqController {
  /**
   * Handles the addition of a friend request.
   * This method is invoked when a friend request is added.
   * It processes the request by calling the appropriate handler function.
   *
   * @param socket - The Socket.IO socket instance used for communication.
   * @param data - The data associated with the friend request.
   *
   * @returns A promise that resolves when the friend request has been processed.
   */
  public async handleFriendReqAdd(socket: Socket, data: string): Promise<void> {
    await friendReqAdd(socket, data);
  }

  public async handleFriendReqRemove(
    socket: Socket,
    friendId: string
  ): Promise<void> {
    await friendReqRemove(socket, friendId);
  }

  public async handleFriendReqResponse(
    socket: Socket,
    data: string
  ): Promise<void> {
    await friendReqResponse(socket, data);
  }

  public async handleFriendReqList(socket: Socket): Promise<void> {
    await friendReqList(socket);
  }

  public async handleFriendReqListPending(socket: Socket): Promise<void> {
    await friendReqListPending(socket);
  }
}
