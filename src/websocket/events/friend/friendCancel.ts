import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Player } from '@root/src/models/player';
import { z } from 'zod';

/**
 * Schema definition for the FriendCancelData object.
 *
 * @property recipientId - The ID of the player who received the friend request.
 */
const FriendCancelData = z.object({
  recipientId: z.string(),
});

/**
 * Handles the 'friendCancel' WebSocket event.
 *
 * This event is triggered when a user cancels a friend request they previously sent.
 * It removes the request from the recipient's friendRequests array.
 *
 * @param data - The data received from the client for the 'friendCancel' event.
 * @param ws - The WebSocket connection of the client.
 */
const friendCancelHandler = createEventHandler(
  'friendCancel',
  async (data, ws) => {
    const validatedData = FriendCancelData.safeParse(data);
    if (!validatedData.success) {
      return { success: false, message: 'Invalid friend cancel data' };
    }

    const player = server.getClientId(ws);

    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    try {
      // declineFriendRequest(receiverId, senderId) removes from receiver's friendRequests
      // Here: recipient received the request FROM the current player
      const result = await Player.declineFriendRequest(
        validatedData.data.recipientId,
        player
      );

      // Notify the recipient if they are online so their pending list refreshes
      if (result.success) {
        const recipientWs = server.getClientWebsocket(validatedData.data.recipientId);
        if (recipientWs) {
          server.emit(recipientWs, 'friendCancelled', { senderId: player });
        }
      }

      return result;
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      return { success: false, message: 'Failed to cancel friend request' };
    }
  }
);

export default friendCancelHandler;
