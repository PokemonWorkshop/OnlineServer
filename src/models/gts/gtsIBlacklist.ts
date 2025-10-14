import { Document, Model, model, Schema } from 'mongoose';

/**
 * Interface representing a GTS (Global Trade Station) blacklist entry.
 *
 * @interface IGTSBlacklist
 * @extends {Document}
 *
 * @property {string} id - The species of the Creature to be blacklisted.
 * @property {string} reason - The reason for blacklisting the Creature.
 * @property {Object} [forbid_conditions] - Optional conditions for the blacklist entry.
 * @property {Object} [forbid_conditions.level] - Optional level conditions for the Creature.
 * @property {number} [forbid_conditions.level.min] - The minimum level of the Creature.
 * @property {number} [forbid_conditions.level.max] - The maximum level of the Creature.
 * @property {boolean} [forbid_conditions.shiny] - Whether the Creature is shiny.
 * @property {number} [forbid_conditions.form] - The form of the Creature.
 * @property {number} [forbid_conditions.nature] - The nature of the Creature.
 */
interface IGtsBlacklist extends Document {
  id: string;
  reason: string;
  forbid_conditions?: {
    level?: { min?: number; max?: number };
    shiny?: boolean;
    form?: number;
    nature?: number;
  };
}

interface IGtsBlacklistModel extends Model<IGtsBlacklist> {
  /**
   * Determines whether a given creature is blacklisted based on predefined conditions.
   *
   * @param {Object} params - The parameters to check against the blacklist.
   * @param {string} params.species - The species of the creature.
   * @param {number} params.level - The level of the creature.
   * @param {boolean} params.shiny - Indicates whether the creature is shiny.
   * @param {number} params.form - The form of the creature (optional).
   * @param {number} params.nature - The nature of the creature (optional).
   * @returns {Promise<{ success: boolean; message?: string }>} - A promise resolving to an object indicating whether the creature is blacklisted (`success: false`) or allowed (`success: true`). If blacklisted, a reason is provided in `message`.
   *
   * @example
   * const result = await GtsBlacklist.isBlacklisted({
   *   species: 'pikachu',
   *   level: 25,
   *   shiny: true,
   *   form: 1,
   *   nature: 5
   * });
   *
   * if (!result.success) {
   *   console.log(`Trade denied: ${result.message}`);
   * } else {
   *   console.log('Trade allowed.');
   * }
   */
  isBlacklisted({
    id,
    level,
    shiny,
    form,
    nature,
  }: {
    id: string;
    level: number;
    shiny: boolean;
    form: number;
    nature: number;
  }): Promise<{ success: boolean; message?: string }>;
}

/**
 * Schema definition for the GTS Blacklist.
 *
 * This schema is used to define the structure of the GTS Blacklist entries.
 * Each entry in the blacklist represents a species that is blacklisted along with the reason and specific conditions.
 *
 * @typedef {Object} IGTSBlacklist
 * @property {string} id - The species name that is blacklisted. This field is required and must be unique.
 * @property {string} reason - The reason why the species is blacklisted. This field is required.
 * @property {Object} forbid_conditions - The conditions under which the species is blacklisted.
 * @property {Object} forbid_conditions.level - The level conditions for the blacklist.
 * @property {number} [forbid_conditions.level.min] - The minimum level for the blacklist condition.
 * @property {number} [forbid_conditions.level.max] - The maximum level for the blacklist condition.
 * @property {boolean} [forbid_conditions.shiny] - Indicates if the shiny form is blacklisted.
 * @property {number} [forbid_conditions.form] - The form identifier for the blacklist condition.
 * @property {number} [forbid_conditions.nature] - The nature identifier for the blacklist condition.
 */
const SGtsBlacklist = new Schema<IGtsBlacklist>({
  id: { type: String, required: true, unique: true },
  reason: { type: String, required: true },
  forbid_conditions: {
    level: {
      min: { type: Number },
      max: { type: Number },
    },
    shiny: { type: Boolean },
    form: { type: Number },
    nature: { type: Number },
  },
});

SGtsBlacklist.statics.isBlacklisted = async function ({
  id,
  level,
  shiny,
  form,
  nature,
}: {
  id: string;
  level: number;
  shiny: boolean;
  form: number;
  nature: number;
}): Promise<{ success: boolean; message?: string }> {
  const blacklistEntry = await this.findOne({ id });

  if (!blacklistEntry) {
    return { success: true };
  }

  const conditions = blacklistEntry.forbid_conditions || {};

  if (
    (conditions.shiny !== undefined && conditions.shiny !== shiny) ||
    (conditions.level?.min !== undefined && level < conditions.level.min) ||
    (conditions.level?.max !== undefined && level > conditions.level.max) ||
    (conditions.form !== undefined && conditions.form !== form) ||
    (conditions.nature !== undefined && conditions.nature !== nature)
  ) {
    return { success: true };
  }

  return { success: false, message: blacklistEntry.reason };
};

/**
 * Represents the GtsBlacklist model.
 *
 * This model is used to interact with the GtsBlacklist collection in the database.
 * It uses the IGTSBlacklist interface for the document structure and the IGTSBlacklistModel
 * interface for the model's static methods.
 *
 * @type {Model<IGTSBlacklist, IGTSBlacklistModel>}
 */
const GtsBlacklist = model<IGtsBlacklist, IGtsBlacklistModel>(
  'GtsBlacklist',
  SGtsBlacklist
);

export { GtsBlacklist, IGtsBlacklist };
