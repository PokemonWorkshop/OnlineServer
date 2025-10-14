import { ICreatures } from "./creature.model";

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
export interface IEggs
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
