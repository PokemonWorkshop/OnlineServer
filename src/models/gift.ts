import { Document, Model, model, Schema } from 'mongoose';

/**
 * Represents an item with an identifier and a count.
 *
 * @interface IItems
 * @property {string} id - The unique identifier for the item.
 * @property {number} count - The count of the item.
 */
interface IItems {
  id: string;
  count: number;
}

/**
 * Represents a creature with various attributes.
 *
 * @interface ICreatures
 * @property {string} id - The unique identifier for the creature.
 * @property {number} level - The level of the creature.
 * @property {boolean} [shiny] - Indicates if the creature is shiny.
 * @property {number} [form] - The form of the creature.
 * @property {number} [gender] - The gender of the creature.
 * @property {number} [nature] - The nature of the creature.
 * @property {number | string} [ability] - The ability of the creature.
 * @property {number} [loyalty] - The loyalty level of the creature.
 * @property {number[]} [stats] - The stats of the creature.
 * @property {number[]} [bonus] - The bonus stats of the creature.
 * @property {string[]} [moves] - The moves of the creature.
 * @property {number | string} [item] - The item held by the creature.
 * @property {string} [given_name] - The given name of the creature.
 * @property {number | string} [captured_with] - The method used to capture the creature.
 * @property {number} [captured_in] - The location where the creature was captured.
 * @property {Date} [egg_at] - The date when the creature was obtained as an egg.
 * @property {number} [egg_in] - The location where the creature was obtained as an egg.
 * @property {string} [trainer_name] - The name of the trainer who owns the creature.
 * @property {number} [trainer_id] - The ID of the trainer who owns the creature.
 */
interface ICreatures {
  id: string;
  level: number;
  shiny?: boolean;
  form?: number;
  gender?: number;
  nature?: number;
  ability?: number | string;
  loyalty?: number;
  stats?: number[];
  bonus?: number[];
  moves?: string[];
  item?: number | string;
  given_name?: string;
  captured_with?: number | string;
  captured_in?: number;
  egg_at?: Date;
  egg_in?: number;
  trainer_name?: string;
  trainer_id?: number;
}

/**
 * Interface representing an egg, which extends a subset of properties from the ICreature interface.
 *
 * @extends Pick<ICreatures, 'id'>
 * @extends Partial<Pick<ICreatures, 'level' | 'shiny' | 'form' | 'gender' | 'nature' | 'ability' | 'stats' | 'bonus' | 'trainer_name' | 'trainer_id'>>
 *
 * @property {string} id - The unique identifier for the egg, inherited from ICreature.
 * @property {number} [level] - The level of the creature inside the egg, if known (default 1).
 * @property {boolean} [shiny] - Indicates if the creature inside the egg is shiny.
 * @property {string} [form] - The form of the creature inside the egg.
 * @property {string} [gender] - The gender of the creature inside the egg.
 * @property {string} [nature] - The nature of the creature inside the egg.
 * @property {string} [ability] - The ability of the creature inside the egg.
 * @property {object} [stats] - The stats of the creature inside the egg.
 * @property {string} [bonus] - Any bonus attributes of the creature inside the egg.
 * @property {string} [trainer_name] - The name of the trainer who owns the egg.
 * @property {string} [trainer_id] - The ID of the trainer who owns the egg.
 */
interface IEggs
  extends Pick<ICreatures, 'id'>,
    Partial<
      Pick<
        ICreatures,
        | 'level'
        | 'shiny'
        | 'form'
        | 'gender'
        | 'nature'
        | 'ability'
        | 'stats'
        | 'bonus'
        | 'trainer_name'
        | 'trainer_id'
      >
    > {}

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
interface IGift extends Document {
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

interface IGiftModel extends Model<IGift> {
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
 * Schema definition for the Gift model.
 *
 * @typedef {Object} IGift
 * @property {string} id - Unique identifier for the gift, generated by default.
 * @property {string} title - Title of the gift, required.
 * @property {Array<Object>} items - List of items included in the gift.
 * @property {string} items.id - Unique identifier for the item, required.
 * @property {number} items.count - Count of the item, defaults to 1.
 * @property {Array<Object>} creatures - List of creatures included in the gift.
 * @property {string} creatures.id - Unique identifier for the creature, required.
 * @property {number} creatures.level - Level of the creature, required.
 * @property {boolean} [creatures.shiny] - Indicates if the creature is shiny.
 * @property {number} [creatures.form] - Form of the creature.
 * @property {number} [creatures.gender] - Gender of the creature.
 * @property {number} [creatures.nature] - Nature of the creature.
 * @property {Schema.Types.Mixed} [creatures.ability] - Ability of the creature.
 * @property {number} [creatures.loyalty] - Loyalty of the creature.
 * @property {Array<number>} [creatures.stats] - Stats of the creature.
 * @property {Array<number>} [creatures.bonus] - Bonus stats of the creature.
 * @property {Array<string>} [creatures.moves] - Moves of the creature.
 * @property {Schema.Types.Mixed} [creatures.item] - Item held by the creature.
 * @property {string} [creatures.given_name] - Given name of the creature.
 * @property {Schema.Types.Mixed} [creatures.captured_with] - Method used to capture the creature.
 * @property {number} [creatures.captured_in] - Location where the creature was captured.
 * @property {string} [creatures.trainer_name] - Name of the trainer.
 * @property {number} [creatures.trainer_id] - ID of the trainer.
 * @property {Array<Object>} eggs - List of eggs included in the gift.
 * @property {string} eggs.id - Unique identifier for the egg, required.
 * @property {number} eggs.level - Level of the egg, defaults to 1.
 * @property {boolean} [eggs.shiny] - Indicates if the egg is shiny.
 * @property {number} [eggs.form] - Form of the egg.
 * @property {number} [eggs.gender] - Gender of the egg.
 * @property {number} [eggs.nature] - Nature of the egg.
 * @property {Schema.Types.Mixed} [eggs.ability] - Ability of the egg.
 * @property {Array<number>} [eggs.stats] - Stats of the egg.
 * @property {Array<number>} [eggs.bonus] - Bonus stats of the egg.
 * @property {string} [eggs.trainer_name] - Name of the trainer.
 * @property {number} [eggs.trainer_id] - ID of the trainer.
 * @property {Array<string>} claimedBy - List of users who have claimed the gift, defaults to an empty array.
 * @property {Array<string>} allowedClaimers - List of users allowed to claim the gift, defaults to an empty array.
 * @property {string} type - Type of the gift, required, can be either 'code' or 'internet'.
 * @property {string} [code] - Code for the gift, required if the type is 'code'.
 */
const SGift = new Schema<IGift>({
  id: {
    type: String,
    default: function () {
      return `gift-${Math.random().toString(36).substring(2, 10)}`;
    },
    unique: true,
  },
  title: { type: String, required: true },
  items: {
    type: [
      {
        id: { type: String, required: true },
        count: { type: Number, default: 1 },
      },
    ],
    default: [],
  },
  creatures: {
    type: [
      {
        id: { type: String, required: true },
        level: { type: Number, required: true },
        shiny: { type: Boolean },
        form: { type: Number },
        gender: { type: Number },
        nature: { type: Number },
        ability: { type: Schema.Types.Mixed },
        loyalty: { type: Number },
        stats: { type: [Number] },
        bonus: { type: [Number] },
        moves: { type: [String] },
        item: { type: Schema.Types.Mixed },
        given_name: { type: String },
        captured_with: { type: Schema.Types.Mixed },
        captured_in: { type: Number },
        trainer_name: { type: String },
        trainer_id: { type: Number },
      },
    ],
    default: [],
  },
  eggs: {
    type: [
      {
        id: { type: String, required: true },
        level: { type: Number, default: 1 },
        shiny: { type: Boolean },
        form: { type: Number },
        gender: { type: Number },
        nature: { type: Number },
        ability: { type: Schema.Types.Mixed },
        stats: { type: [Number] },
        bonus: { type: [Number] },
        trainer_name: { type: String },
        trainer_id: { type: Number },
      },
    ],
    default: [],
  },
  claimedBy: { type: [String], default: [] },
  allowedClaimers: { type: [String], default: [] },
  type: { type: String, required: true, enum: ['code', 'internet'] },
  code: {
    type: String,
    required: function () {
      return this.type === 'code';
    },
  },
  rarity: { type: Number, default: 0 },
  alwaysAvailable: { type: Boolean, default: false },
  validFrom: { type: Date },
  validTo: {
    type: Date,
    validate: {
      validator: function (this: IGift, value: Date) {
        return !this.validFrom || !value || value > this.validFrom;
      },
      message: 'validTo must be a date after validFrom.',
    },
  },
});

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
 *
 * @constant
 * @type {Model<IGift, IGiftModel>}
 * @template IGift - The interface representing a gift document.
 * @template IGiftModel - The interface representing the gift model.
 */
const Gift = model<IGift, IGiftModel>('Gift', SGift);

export { Gift, IGift };
