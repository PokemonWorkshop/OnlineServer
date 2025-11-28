import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Player } from '@root/src/models/player/player.model';

/**
 * Handles the 'friendPending' WebSocket event.
 *
 * This event retrieves the list of pending friend requests for the player
 * associated with the provided WebSocket connection.
 *
 * @async
 * @param _ - Unused parameter for the event payload.
 * @param ws - The WebSocket connection of the client.
 * @returns An object indicating the success or failure of the operation.
 *          - On success: `{ success: true, data: pending }` where `pending` is the list of pending friend requests.
 *          - On failure: `{ success: false, message: string }` with an appropriate error message.
 *
 * @throws Logs an error to the console if an exception occurs while retrieving pending friend requests.
 */
const friendPendingHandler = createEventHandler(
  'friendPending',
  async (_, ws) => {
    const player = server.getClientId(ws);

    if (!player) return { success: false, message: 'Player not found' };

    try {
      const pending = await Player.getPendingFriendRequest(player);

      return {
        success: true,
        data: pending,
      };
    } catch (error) {
      console.error('Error list friend pending:', error);
      return { success: false, message: 'Failed to list friend pending' };
    }
  }
);

export default friendPendingHandler;
