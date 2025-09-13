import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Player } from '@root/src/models/player';
import { z } from 'zod';

/**
 * Schema definition for the FriendDeclineData object.
 *
 * This schema validates the structure of data related to declining a friend request.
 * It ensures that the `senderId` field is a string.
 *
 * @property senderId - The unique identifier of the user who sent the friend request.
 */
const FriendDeclineData = z.object({
  senderId: z.string(),
});

/**
 * Handles the 'friendDecline' WebSocket event.
 *
 * This event is triggered when a user declines a friend request. The handler
 * validates the incoming data, retrieves the player associated with the WebSocket
 * connection, and processes the friend request decline.
 *
 * @param data - The data received from the client for the 'friendDecline' event.
 * @param ws - The WebSocket connection of the client.
 * @returns An object indicating the success or failure of the operation, along with
 *          an appropriate message.
 */
const friendDeclineHandler = createEventHandler(
  'friendDecline',
  async (data, ws) => {
    const validatedData = FriendDeclineData.safeParse(data);
    if (!validatedData.success) {
      return { success: false, message: 'Invalid friend request decline data' };
    }

    const player = server.getClientId(ws);

    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    try {
      const result = await Player.declineFriendRequest(
        player,
        validatedData.data.senderId
      );
      return result;
    } catch (error) {
      console.error('Error declining friend request:', error);
      return { success: false, message: 'Failed to decline friend request' };
    }
  }
);

export default friendDeclineHandler;
