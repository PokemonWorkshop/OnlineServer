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
export interface ICreatures {
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
