import { server } from '@root/src';
import { Gift } from '@root/src/models/gift/gift.model';
import createEventHandler from '@logic/createEventHandler';
import { z } from 'zod';

const GiftClaimByIdData = z.object({
  id: z.string(),
});
/**
 * Handles the 'giftClaimById' event.
 *
 * This event is triggered when a user claims a gift using a code. The handler
 * validates the incoming data, retrieves the player associated with the WebSocket
 * connection, and processes the gift claim.
 *
 * @param data - The data received from the client for the 'giftClaimById' event.
 * @param ws - The WebSocket connection of the client.
 * @returns An object indicating the success or failure of the operation, along with
 * an appropriate message.
 *  */
const giftClaimByIdHandler = createEventHandler(
  'giftClaimById',
  async (data, ws) => {
    const validatedData = GiftClaimByIdData.safeParse(data);
    if (!validatedData.success) {
      return { success: false, message: 'Invalid gift claim data' };
    }

    const player = server.getClientId(ws);

    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    try {
      const result = await Gift.claimGift(player, validatedData.data);
      return result;
    } catch (error) {
      console.error('Error claiming gift by id:', error);
      return { success: false, message: 'Failed to claim gift by id' };
    }
  }
);

export default giftClaimByIdHandler;
