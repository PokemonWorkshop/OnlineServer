import { model, Model } from 'mongoose';
import { ICreature } from './creature.model';
import { SGts } from './gts.schema';

/**
 * Interface representing a GTS (Global Trade Station) entry.
 *
 * @interface IGts
 * @extends {Document}
 *
 * @property {string} id - Unique identifier for the GTS entry.
 * @property {string} player_id - Identifier for the player associated with the GTS entry.
 * @property {Object} creature - Details of the creature being traded.
 * @property {string} creature.id - id of the creature.
 * @property {number} creature.level - Level of the creature.
 * @property {boolean} creature.shiny - Indicates if the creature is shiny.
 * @property {number} creature.form - Form of the creature.
 * @property {number} creature.nature - Nature of the creature.
 * @property {Record<string, unknown>} creature.data - Additional data related to the creature.
 * @property {Object} require_conditions - Conditions that Require the trade.
 * @property {string} require_conditions.id - id that are required.
 * @property {Object} require_conditions.level - Level range that is required.
 * @property {number} require_conditions.level.min - Minimum level that is required.
 * @property {number} require_conditions.level.max - Maximum level that is required.
 * @property {boolean} require_conditions.shiny - Indicates if shiny creatures are required.
 * @property {number} require_conditions.form - Form that is required.
 * @property {number} require_conditions.nature - Nature that is required.
 * @property {Date} createdAt - Date when the GTS entry was created.
 */
export interface IGts extends Document {
  id: string;
  player_id: string;
  creature: Record<string, unknown>;
  require_conditions: {
    id: string;
    level: { min: number; max?: number };
    shiny?: boolean;
    form?: number;
    nature?: number;
  };
  status: 'deposited' | 'retrieved' | 'traded';
  createdAt: Date;
}

export interface IGtsModel extends Model<IGts> {
  /**
   * Adds a creature to the Global Trade Station (GTS) for a player.
   *
   * @param player_id - The ID of the player adding the creature to the GTS.
   * @param creature - The creature to be added to the GTS.
   * @param require_conditions - Conditions under which the creature cannot be traded.
   * @returns An object indicating the success of the operation and an optional message.
   *
   * @remarks
   * This function checks if the creature is blacklisted before adding it to the GTS.
   * If the creature is blacklisted, the function returns a failure message.
   * Otherwise, it saves the new GTS entry and returns a success message.
   */
  addToGTS(
    player_id: string,
    creature: ICreature,
    require_conditions: IGts['require_conditions']
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Removes a creature from the Global Trade System (GTS) for a given player.
   *
   * @param player_id - The unique identifier of the player.
   * @returns A promise that resolves to an object indicating the success status and an optional message.
   */
  removeFromGTS(
    player_id: string
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Executes a trade between two players, where player A offers a creature to player B.
   * The trade is subject to certain conditions that must be met by the offered creature.
   *
   * @param playerA_id - The ID of player A who is offering a creature.
   * @param offeredCreature - The creature offered by player A for the trade.
   * @returns A promise that resolves to an object indicating the success of the trade,
   *          an optional message, and the creature received by player B if the trade is successful.
   */
  tradeWithOffer(
    playerA_id: string,
    offeredCreature: ICreature
  ): Promise<{
    success: boolean;
    message?: string;
    receivedCreature?: IGts['creature'];
  }>;

  getPlayerCreatures(
    player_id: string
  ): Promise<{ deposited: IGts[]; traded: IGts[]; retrieved: IGts[] }>;

  getAllCreatures(filters: {
    id?: string;
    level?: {
      min?: number;
      max?: number;
    };
    shiny?: boolean;
    form?: number;
    nature?: number;
  }): Promise<IGts[]>;
}

/**
 * Represents the Gts model.
 */
export const Gts = model<IGts, IGtsModel>('Gts', SGts);

