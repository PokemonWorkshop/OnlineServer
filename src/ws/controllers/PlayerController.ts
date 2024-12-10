import { Socket } from 'socket.io';
import { playerCreate } from './player/playerCreate';
import { playerDelete } from './player/playerDelete';

/**
 * Controller class responsible for managing player-related operations.
 */
export class PlayerController {
  /**
   * Handles the creation of a player.
   * This method is invoked when a player creation request is received.
   * It processes the request by calling the appropriate handler function.
   *
   * @param socket - The Socket.IO socket instance used for communication.
   * @param data - The data associated with the player creation request.
   * This parameter is of type `unknown`, so it should be properly validated
   * and typed inside the handler.
   *
   * @returns A promise that resolves when the player creation process is completed.
   */
  public async handlePlayerCreate(
    socket: Socket,
    data: unknown
  ): Promise<void> {
    await playerCreate(socket, data);
  }

  /**
   * Handles the deletion of a player.
   * This method is invoked when a player deletion request is received.
   * It processes the request by calling the appropriate handler function.
   *
   * @param socket - The Socket.IO socket instance used for communication.
   * This parameter is optional and represents the ID of the player to be deleted.
   *
   * @returns A promise that resolves when the player deletion process is completed.
   */
  public async handlePlayerDelete(socket: Socket): Promise<void> {
    await playerDelete(socket);
  }
}
