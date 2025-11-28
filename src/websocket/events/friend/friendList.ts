import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Player } from '@root/src/models/player/player.model';

/**
 * Handles the 'friendList' event for retrieving a player's friend list.
 *
 * @param _ - Unused parameter for event data.
 * @param ws - The WebSocket connection of the client making the request.
 * @returns A promise that resolves to an object containing the success status and either
 *          the list of friends (on success) or an error message (on failure).
 *
 * @remarks
 * - If the player associated with the WebSocket connection cannot be found, the handler
 *   returns a failure response with an appropriate message.
 * - If an error occurs while retrieving the friend list, the error is logged, and a failure
 *   response is returned.
 */
const friendListHandler = createEventHandler('friendList', async (_, ws) => {
  const player = server.getClientId(ws);

  if (!player) return { success: false, message: 'Player not found' };

  try {
    const friends = await Player.getFriendList(player);

    return {
      success: true,
      data: friends,
    };
  } catch (error) {
    console.error('Error list friend:', error);
    return { success: false, message: 'Failed to list friend' };
  }
});

export default friendListHandler;
