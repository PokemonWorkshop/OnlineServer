import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Player } from '@root/src/models/player/player.model';
import { z } from 'zod';

/**
 * Schema definition for the data structure used in the "friend accept" event.
 *
 * This schema validates the payload of the event, ensuring it contains the
 * required `senderId` field as a string.
 *
 * @property senderId - The unique identifier of the user sending the friend request.
 */
const FriendAcceptData = z.object({
  senderId: z.string(),
});

/**
 * Handles the "friendAccept" WebSocket event.
 *
 * This event is triggered when a user accepts a friend request. The handler
 * validates the incoming data, retrieves the player associated with the WebSocket
 * connection, and processes the friend request acceptance.
 *
 * @param data - The data sent with the "friendAccept" event.
 * @param ws - The WebSocket connection of the client.
 * @returns A promise that resolves to an object indicating the success or failure
 */
const friendAcceptHandler = createEventHandler(
  'friendAccept',
  async (data, ws) => {
    const validatedData = FriendAcceptData.safeParse(data);
    if (!validatedData.success) {
      return { success: false, message: 'Invalid friend request accept data' };
    }

    const player = server.getClientId(ws);

    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    try {
      const result = await Player.acceptedFriendRequest(
        player,
        validatedData.data.senderId
      );
      return result;
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return { success: false, message: 'Failed to accept friend request' };
    }
  }
);

export default friendAcceptHandler;
