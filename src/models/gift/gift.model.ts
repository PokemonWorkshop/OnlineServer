import { model, Model } from "mongoose";
import { ICreatures } from "./creature.model";
import { IEggs } from "./egg.model";
import { IItems } from "./items.model";
import { SGift } from "./gift.schema";

/**
 * Represents a gift in the system.
 *
 * @interface IGift
 * @extends {Document}
 *
 * @property {string} id - The unique identifier for the gift.
 * @property {string} title - The title of the gift.
 * @property {IItem[]} [items] - Optional array of items included in the gift.
 * @property {ICreature[]} [creatures] - Optional array of creatures included in the gift.
 * @property {IEggs[]} [eggs] - Optional array of eggs included in the gift.
 * @property {string[]} claimedBy - Array of player IDs who have claimed the gift.
 * @property {string[]} allowedClaimers - Array of player IDs who are allowed to claim the gift.
 * @property {'code' | 'internet'} type - The type of the gift, either 'code' or 'internet'.
 * @property {string} [code] - Optional code associated with the gift, if the type is 'code'.
 *
 * @method canClaimed
 * @param {string} playerId - The ID of the player attempting to claim the gift.
 * @returns {{ canClaim: boolean; message?: string }} - An object indicating whether the player can claim the gift and an optional message.
 */
export interface IGift extends Document {
  id: string;
  title: string;
  items?: IItems[];
  creatures?: ICreatures[];
  eggs?: IEggs[];
  claimedBy: string[];
  allowedClaimers: string[];
  type: 'code' | 'internet';
  code?: string;
  rarity?: number;
  alwaysAvailable: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  canClaimed(playerId: string): {
    canClaim: boolean;
    message?: string;
  };
}

export interface IGiftModel extends Model<IGift> {
  /**
   * Static method to get claimable gifts by internet for a user.
   *
   * @param {string} userId - The ID of the user.
   * @returns {Promise<Array<Pick<IGift, 'id' | 'title'>>>} A promise that resolves to an array of objects containing the id and title of claimable gifts.
   */
  getClaimableGiftsByInternet(
    userId: string
  ): Promise<Pick<IGift, 'id' | 'title'>[]>;
  /**
   * Claims a gift for a user based on the provided gift ID or code.
   *
   * @param userId - The ID of the user claiming the gift.
   * @param param - An object containing either the gift ID or code.
   * @param param.id - The ID of the gift (optional).
   * @param param.code - The code of the gift (optional).
   * @returns A promise that resolves to an object indicating the success of the operation,
   *          a message, and optionally the claimed gift details.
   *          If the gift is not found or cannot be claimed, success will be false and
   *          an appropriate message will be provided.
   *          If the gift is successfully claimed, success will be true and the gift details
   *          will be included in the response.
   */
  claimGift(
    userId: string,
    { id, code }: { id?: string; code?: string }
  ): Promise<{
    success: boolean;
    message: string;
    gifts?: {
      id: string;
      title: string;
      items: IItems[];
      creatures: ICreatures[];
      eggs: IEggs[];
    };
  }>;
  /**
   * Deletes multiple documents from the collection based on the specified criteria.
   *
   * @returns {Promise<number>} The number of documents deleted.
   */
  clearExpiredGifts(): Promise<number>;
}

/**
 * Pre-save hook for SGift model.
 *
 * This middleware function is executed before saving a document.
 * If the `alwaysAvailable` property is set to true, it sets the `validFrom` and `validTo` properties to null.
 *
 * @param {Function} _next - The next middleware function in the stack.
 */
SGift.pre('save', function (next) {
  if (this.alwaysAvailable) {
    this.validFrom = null;
    this.validTo = null;
  }
  next();
});

/**
 * Determines if a player can claim the gift.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Object} An object containing a boolean indicating if the player can claim the gift and an optional message.
 * @returns {boolean} return.canClaim - True if the player can claim the gift, false otherwise.
 * @returns {string} [return.message] - An optional message explaining why the player cannot claim the gift.
 */
SGift.methods.canClaimed = function (userId: string): {
  canClaim: boolean;
  message?: string;
} {
  const now = new Date();

  if (!this.alwaysAvailable) {
    if (this.validFrom && now < this.validFrom) {
      return {
        canClaim: false,
        message: 'This gift is not available at the moment.',
      };
    }

    if (this.validTo && now > this.validTo) {
      return {
        canClaim: false,
        message: 'This gift has expired.',
      };
    }
  }

  if (this.claimedBy.includes(userId)) {
    return { canClaim: false, message: 'Gift already claimed.' };
  }

  if (
    this.allowedClaimers.length > 0 &&
    !this.allowedClaimers.includes(userId)
  ) {
    return {
      canClaim: false,
      message: 'You are not allowed to claim this gift.',
    };
  }
  return { canClaim: true };
};

/**
 * Static method to get claimable gifts by code for a user.
 *
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Array<Pick<IGift, 'id' | 'code' | 'title'>>>} A promise that resolves to an array of objects containing the id in code and title of claimable gifts.
 */
SGift.statics.getClaimableGiftsByInternet = async function (
  userId: string
): Promise<Pick<IGift, 'id' | 'title'>[]> {
  return this.find(
    {
      type: 'internet',
      claimedBy: { $ne: userId },
      $or: [{ allowedClaimers: { $size: 0 } }, { allowedClaimers: userId }],
    },
    { id: 1, title: 1, _id: 0 }
  ).lean();
};

/**
 * Claims a gift for a user based on the provided gift ID or code.
 *
 * @param userId - The ID of the user claiming the gift.
 * @param param - An object containing either the gift ID or code.
 * @param param.id - The ID of the gift (optional).
 * @param param.code - The code of the gift (optional).
 * @returns A promise that resolves to an object indicating the success of the operation,
 *          a message, and optionally the claimed gift details.
 *          If the gift is not found or cannot be claimed, success will be false and
 *          an appropriate message will be provided.
 *          If the gift is successfully claimed, success will be true and the gift details
 *          will be included in the response.
 */
SGift.statics.claimGift = async function (
  userId: string,
  { id, code }: { id?: string; code?: string }
): Promise<{
  success: boolean;
  message: string;
  gifts?: {
    id: string;
    title: string;
    items: IItems[];
    creatures: ICreatures[];
    eggs: IEggs[];
  };
}> {
  const query = id ? { id } : { code };
  const gift = await this.findOne(query);
  if (!gift) {
    return { success: false, message: 'Gift not found' };
  }
  const { canClaim, message } = gift.canClaimed(userId);
  if (!canClaim) {
    return { success: false, message };
  }
  gift.claimedBy.push(userId);
  await gift.save();
  return {
    success: true,
    message: 'Gift successfully claimed',
    gifts: {
      id: gift.id,
      title: gift.title,
      items: gift.items,
      creatures: gift.creatures,
      eggs: gift.eggs,
    },
  };
};

/**
 * Deletes multiple documents from the collection based on the specified criteria.
 *
 * @returns {Promise<number>} The number of documents deleted.
 */
SGift.statics.clearExpiredGifts = async function (): Promise<number> {
  const now = new Date();
  try {
    const result = await this.deleteMany({
      alwaysAvailable: false,
      validTo: { $lte: now },
    });
    console.log(`${result.deletedCount} expired gifts removed.`);
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error clearing expired gifts:', error);
    return 0;
  }
};

/**
 * Represents the Gift model.
 */
export const Gift: IGiftModel =  model<IGift, IGiftModel>('Gift', SGift);

