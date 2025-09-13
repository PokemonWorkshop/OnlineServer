import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Player } from '@root/src/models/player';
import { z } from 'zod';

/**
 * Schema for validating the data required to remove a friend.
 *
 * This object ensures that the `friendId` field is a string, which
 * represents the unique identifier of the friend to be removed.
 */
const FriendRemoveData = z.object({
  friendId: z.string(),
});

/**
 * Handles the 'friendRemove' WebSocket event.
 *
 * This event is triggered when a user attempts to remove a friend.
 * The handler validates the incoming data, retrieves the player associated
 * with the WebSocket connection, and attempts to remove the specified friend.
 *
 * @param data - The data sent with the 'friendRemove' event.
 * @param ws - The WebSocket connection of the client sending the event.
 * @returns An object indicating the success or failure of the operation.
 */
const friendRemoveHandler = createEventHandler(
  'friendRemove',
  async (data, ws) => {
    const validatedData = FriendRemoveData.safeParse(data);
    if (!validatedData.success) {
      return { success: false, message: 'Invalid friend remove data' };
    }

    const player = server.getClientId(ws);

    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    try {
      const result = await Player.removeFriend(
        player,
        validatedData.data.friendId
      );
      return result;
    } catch (error) {
      console.error('Error removing friend:', error);
      return { success: false, message: 'Failed to remove friend' };
    }
  }
);

export default friendRemoveHandler;
