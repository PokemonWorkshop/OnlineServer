import { z } from 'zod';
import createEventHandler from '@logic/createEventHandler';
import { Player } from '@root/src/models/player/player.model';
import { server } from '@root/src';

/**
 * Schema definition for validating friend request data.
 *
 * This object ensures that the required `toFriendCode` field is a string.
 * It is used to validate the structure of data sent in a friend request.
 */
const FriendRequestData = z.object({
  toFriendCode: z.string(),
});

/**
 * Handles the 'friendRequest' WebSocket event.
 *
 * This event is triggered when a user sends a friend request. The handler
 * validates the incoming data, retrieves the player associated with the WebSocket
 * connection, and attempts to send a friend request to the specified friend code.
 *
 * @param data - The incoming data for the friend request event.
 * @param ws - The WebSocket connection of the client sending the request.
 * @returns An object indicating the success or failure of the operation, along with
 *          an appropriate message.
 */
const friendRequestHandler = createEventHandler(
  'friendRequest',
  async (data, ws) => {
    const validatedData = FriendRequestData.safeParse(data);

    if (!validatedData.success) {
      return { success: false, message: 'Invalid friend quest data' };
    }

    const player = server.getClientId(ws);

    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    try {
      const result = await Player.sendFriendRequest(
        player,
        validatedData.data.toFriendCode
      );
      return result;
    } catch (error) {
      console.error('Error sending friend request:', error);
      return { success: false, message: 'Failed to send friend request' };
    }
  }
);

export default friendRequestHandler;
