import { server } from '@root/src';
import { Gift } from '@root/src/models/gift';
import createEventHandler from '@logic/createEventHandler';
import { z } from 'zod';

const GiftClaimByCodeData = z.object({
  code: z.string(),
});
/**
 * Handles the 'giftClaimByCode' event.
 *
 * This event is triggered when a user claims a gift using a code. The handler
 * validates the incoming data, retrieves the player associated with the WebSocket
 * connection, and processes the gift claim.
 *
 * @param data - The data received from the client for the 'giftClaimByCode' event.
 * @param ws - The WebSocket connection of the client.
 * @returns An object indicating the success or failure of the operation, along with
 * an appropriate message.
 *  */
const giftClaimByCodeHandler = createEventHandler(
  'giftClaimByCode',
  async (data, ws) => {
    const validatedData = GiftClaimByCodeData.safeParse(data);
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
      console.error('Error claiming gift by code:', error);
      return { success: false, message: 'Failed to claim gift by code' };
    }
  }
);

export default giftClaimByCodeHandler;
