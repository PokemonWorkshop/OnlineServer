import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Gift } from '@root/src/models/gift/gift.model';

/**
 * Handles the 'giftList' event by retrieving the list of claimable gifts for the player.
 *
 * @param _data - Unused parameter.
 * @param ws - The WebSocket connection of the player.
 * @returns An object indicating the success or failure of the operation, along with a message and the list of gifts if successful.
 */
const giftListHandler = createEventHandler('giftList', async (_data, ws) => {
  const player = server.getClientId(ws);

  if (!player) {
    return { success: false, message: 'Player not found' };
  }

  try {
    const result = await Gift.getClaimableGiftsByInternet(player);

    return {
      success: true,
      message: 'Gift list retrieved successfully',
      list_gift: result,
    };
  } catch (error) {
    console.error('Error retrieving gift list:', error);
    return { success: false, message: 'Failed to retrieve gift list' };
  }
});

export default giftListHandler;
