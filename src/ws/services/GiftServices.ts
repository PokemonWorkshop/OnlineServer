import { Gift, IGift } from '@models/Gift';
import { HttpStatusCode, SocketResponse } from './SocketServices';

/**
 * Removes all expired gifts from the database.
 *
 * This function deletes all gift documents where the end date (`endDate`)
 * is earlier than the current date. It returns the count of deleted gifts.
 *
 * @returns {Promise<number>} - The number of deleted expired gifts.
 * @throws {Error} - If an error occurs during deletion.
 */
async function removeExpiredGifts(): Promise<number> {
  try {
    const currentDate = new Date();
    const result = await Gift.deleteMany({
      'availability.endDate': { $lt: currentDate },
      alwaysAvailable: false,
    });
    return result.deletedCount;
  } catch (error) {
    console.error(`Error deleting expired gifts: ${error}`);
    throw error;
  }
}

/**
 * Fetches a gift by its unique ID.
 *
 * This function retrieves a gift from the database using the `giftId`.
 * If the gift is found, it is returned; otherwise, `null` is returned.
 *
 * @param {string} giftId - The unique ID of the gift to be fetched.
 * @returns {Promise<IGift | null>} - The gift object or `null` if not found.
 * @throws {Error} - If an error occurs during retrieval.
 */
async function getGiftById(giftId: string): Promise<IGift | null> {
  try {
    const gift = await Gift.findOne({ giftId }).exec();
    return gift;
  } catch (error) {
    console.error(`Error fetching gift: ${error}`);
    throw error;
  }
}

/**
 * Retrieves all gifts from the database.
 *
 * This function returns a list of all gift objects stored in the database.
 *
 * @returns {Promise<IGift[]>} - An array of all gifts.
 * @throws {Error} - If an error occurs during retrieval.
 */
async function getAllGift(): Promise<IGift[]> {
  try {
    const gifts = await Gift.find().exec();
    return gifts;
  } catch (error) {
    console.error(`Error fetching all gifts: ${error}`);
    throw error;
  }
}

/**
 * Deletes a gift by its unique ID.
 *
 * This function finds a gift by its `giftId` and deletes it. If the gift is
 * not found, it returns `null`. If the gift is found, it returns the deleted
 * gift object.
 *
 * @param {string} giftId - The unique ID of the gift to be deleted.
 * @returns {Promise<IGift | null>} - The deleted gift object or `null` if not found.
 * @throws {Error} - If an error occurs during deletion.
 */
async function deleteGift(giftId: string): Promise<IGift | null> {
  try {
    const gift = await Gift.findOne({ giftId }).exec();

    if (!gift) {
      console.error(`Gift with giftId ${giftId} not found`);
      return null;
    }

    return gift;
  } catch (error) {
    console.error(`Error deleting gift with ID ${giftId}: ${error}`);
    throw error;
  }
}

/**
 * Updates a gift by its unique identifier.
 *
 * This function finds a gift by its `giftId` and updates it with the provided new data.
 * It returns the updated gift object.
 *
 * @param {string} giftId - The unique identifier of the gift to be updated.
 * @param {Partial<IGift>} updateData - The update data for the gift.
 * @returns {Promise<IGift | null>} - The updated gift object or `null` if not found.
 * @throws {Error} - If an error occurs during the update.
 */
async function updateGift(
  giftId: string,
  updateData: Partial<IGift>
): Promise<IGift | null> {
  try {
    const gift = await Gift.findOneAndUpdate({ giftId }, updateData, {
      new: true,
    });
    return gift;
  } catch (error) {
    console.error(`Error updating gift with ID ${giftId}: ${error}`);
    throw error;
  }
}

/**
 * Deletes all gifts from the database.
 *
 * This function removes all documents from the `Gift` collection. It returns
 * the count of deleted documents.
 *
 * @returns {Promise<number>} - The number of deleted gifts.
 * @throws {Error} - If an error occurs during deletion.
 */
async function deleteAllGift(): Promise<number> {
  try {
    const result = await Gift.deleteMany({});
    console.log(`Deleted ${result.deletedCount} gifts.`);
    return result.deletedCount;
  } catch (error) {
    console.error(`Error deleting all gifts: ${error}`);
    throw error;
  }
}

/**
 * Claims a gift for a player.
 *
 * This function attempts to claim a gift for the specified player. It checks various conditions to ensure
 * that the gift can be claimed, including whether the gift is active, whether the player has not already claimed it,
 * and whether the gift is within its availability period (unless it is marked as always available). If all conditions are met,
 * the player's ID is added to the list of those who have claimed the gift.
 *
 * @param {string} giftId - The unique identifier of the gift to be claimed.
 * @param {string} playerId - The unique identifier of the player claiming the gift.
 * @returns {Promise<{
 *   status: boolean;
 *   message: string;
 *   data?: {
 *     items?: Partial<IGift['items']>;
 *     creatures?: Partial<IGift['creatures']>;
 *   };
 * }>} - An object representing the result of the claim operation:
 *
 *   - `status` indicates whether the gift was successfully claimed (`true`) or not (`false`).
 *   - `message` provides additional information about the result of the claim operation, such as reasons for failure.
 *   - `data` contains optional details about the gift if it was successfully claimed:
 *     - `items` is an array of the items included in the gift, with properties possibly being partially omitted.
 *     - `creatures` is an array of the creatures included in the gift, with properties possibly being partially omitted.
 *
 * @throws {Error} - Throws an error if an unexpected issue occurs during the claim process. The error is logged for debugging.
 */
async function claimGift(
  giftId: string,
  playerId: string
): Promise<SocketResponse> {
  try {
    const now = new Date();

    const gift = await Gift.findOne({
      giftId,
      $or: [
        { alwaysAvailable: true },
        {
          alwaysAvailable: false,
          'availability.startDate': { $lte: now },
          'availability.endDate': { $gte: now },
        },
      ],
    })
      .select('-__v')
      .exec();

    if (!gift) {
      return {
        success: false,
        status: {
          code: HttpStatusCode.NotFound,
          message: 'Gift not found or not available.',
        },
        details: {
          message: `The gift with ID ${giftId} was not found or is not currently available.`,
          providedData: giftId,
        },
      };
    }

    if (gift.claimedBy.includes(playerId)) {
      return {
        success: false,
        status: {
          code: HttpStatusCode.Conflict,
          message: 'Gift has already been claimed',
        },
        details: {
          message:
            'You have already claimed this gift and cannot claim it again.',
          providedData: { playerId, giftId },
        },
      };
    }

    gift.claimedBy.push(playerId);
    await gift.save();

    return {
      success: true,
      status: {
        code: HttpStatusCode.OK,
        message: 'Gift claimed successfully!',
      },
      data: {
        items: gift.items,
        creatures: gift.creatures,
      },
    };
  } catch (error) {
    console.error(`Error claiming Gift: ${error}`);
    throw error;
  }
}

/**
 * Checks if the provided redeem code is valid for a gift of type 'code'.
 *
 * This function verifies whether the redeem code matches a gift of type 'code'.
 * If valid, it returns the gift ID associated with the code.
 *
 * @param {string} redeemCode - The code provided for redeeming the gift.
 * @returns {Promise<{
 *   valid: boolean;
 *   message?: string;
 *   giftId?: string;
 * }>} - An object representing the result of the validation:
 *
 *   - `valid` indicates whether the redeem code is valid (`true`) or not (`false`).
 *   - `message` provides additional information about the validation result.
 *   - `giftId` is included if the code is valid, representing the ID of the matching gift.
 *
 * @throws {Error} - Throws an error if an issue occurs during the validation process. The error is logged for debugging.
 */
async function checkCode(redeemCode: string): Promise<{
  success: boolean;
  giftId?: string;
}> {
  try {
    const gift = await Gift.findOne({
      redeemType: 'code',
      redeemCode,
    }).exec();

    if (!gift) {
      return { success: false };
    }

    return { success: true, giftId: gift.giftId };
  } catch (error) {
    console.error(`Error checking redeem code: ${error}`);
    throw error;
  }
}

async function getListAvailableGift(playerId: string): Promise<IGift[]> {
  const now = new Date();

  try {
    const availableGifts = await Gift.find({
      redeemType: 'internet',
      $or: [
        { alwaysAvailable: true },
        {
          alwaysAvailable: false,
          'availability.startDate': { $lte: now },
          'availability.endDate': { $gte: now },
        },
      ],
      claimedBy: { $ne: playerId },
    })
      .select('giftId description items creatures -_id')
      .exec();

    return availableGifts;
  } catch (error) {
    console.error(`Error fetching available gifts: ${error}`);
    throw error;
  }
}

export {
  removeExpiredGifts,
  getGiftById,
  getAllGift,
  deleteGift,
  updateGift,
  deleteAllGift,
  claimGift,
  checkCode,
  getListAvailableGift,
};
