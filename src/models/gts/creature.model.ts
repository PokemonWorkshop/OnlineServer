/**
 * Represents a creature in the GTS system.
 *
 * @interface ICreature
 * @property {string} id - The unique identifier for the creature.
 * @property {number} level - The level of the creature.
 * @property {boolean} shiny - Indicates if the creature is shiny.
 * @property {number} form - The form of the creature.
 * @property {number} nature - The nature of the creature.
 */
export interface ICreature {
  id: string;
  level: number;
  shiny: boolean;
  form: number;
  nature: number;
}

