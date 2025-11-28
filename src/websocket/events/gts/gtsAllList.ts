import { z } from 'zod';
import createEventHandler from '@logic/createEventHandler';
import { Gts } from '@root/src/models/gts/gts.model';

/**
 * Schema for filtering the creatures based on user input.
 *
 * @property {string} db_symbol - The species to filter by (optional).
 * @property {number} level - The level to filter by (optional).
 * @property {boolean} shiny - Whether the creature is shiny (optional).
 * @property {number} form - The form to filter by (optional).
 * @property {number} nature - The nature to filter by (optional).
 */
const GtsFilterData = z.object({
  db_symbol: z.string().optional(),
  level: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  shiny: z.boolean().optional(),
  form: z.number().optional(),
  nature: z.number().optional(),
});

/**
 * Handles the 'gtsAllList' event to retrieve a list of creatures available in the GTS.
 * Allows filtering based on various criteria.
 *
 * @param data - The filter data containing the filter conditions.
 * @param ws - The WebSocket connection of the client.
 * @returns A list of creatures available on the GTS, possibly filtered.
 *
 * @remarks
 * - Validates the incoming filter data using `GtsFilterData.safeParse`.
 * - Retrieves all the creatures in the GTS, possibly applying filters.
 */
const gtsAllListHandler = createEventHandler(
  'gtsAllList',
  async (data, _ws) => {
    const validatedData = GtsFilterData.safeParse(data);

    if (!validatedData.success) {
      return { success: false, message: 'Invalid filter data' };
    }

    try {
      const creatures = await Gts.getAllCreatures(validatedData.data);

      return {
        success: true,
        creatures,
      };
    } catch (error) {
      console.error('Error retrieving creatures from GTS:', error);
      return {
        success: false,
        message: 'Failed to retrieve creatures from GTS',
      };
    }
  }
);

export default gtsAllListHandler;
