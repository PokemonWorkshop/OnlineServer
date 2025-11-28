import { z } from 'zod';
import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Gts } from '@root/src/models/gts/gts.model';

/**
 * Schema for GTS Add Data.
 *
 * This schema validates the structure of the data required for adding a creature
 * to the Global Trade System (GTS). It includes details about the creature and
 * any conditions that forbid certain trades.
 *
 * @property {object} creature - The creature data.
 * @property {string} creature.id - The od of the creature.
 * @property {number} creature.level - The level of the creature.
 * @property {boolean} creature.shiny - Indicates if the creature is shiny.
 * @property {number} creature.form - The form of the creature.
 * @property {number} creature.nature - The nature of the creature.
 * @property {string} creature.data - Additional data about the creature.
 *
 * @property {object} require_condition - Conditions that forbid certain trades.
 * @property {string} require_condition.id - The species that are forbidden.
 * @property {object} require_condition.level - The level conditions that are forbidden.
 * @property {number} require_condition.level.min - The minimum level that is forbidden.
 * @property {number} [require_condition.level.max] - The maximum level that is forbidden (optional).
 * @property {boolean} [require_condition.shiny] - Indicates if shiny creatures are forbidden (optional).
 * @property {number} [require_condition.form] - The form that is forbidden (optional).
 * @property {number} [require_condition.nature] - The nature that is forbidden (optional).
 */
const GtsAddData = z.object({
  creature: z.object({
    id: z.string(),
    level: z.number(),
    shiny: z.boolean(),
    form: z.number(),
    nature: z.number(),
  }).passthrough(),
  require_conditions: z.object({
    id: z.string(),
    level: z.object({ min: z.number(), max: z.number().optional() }),
    shiny: z.boolean().optional(),
    form: z.number().optional(),
    nature: z.number().optional(),
  }),
});

/**
 * Handles the 'gtsAdd' event by validating the incoming data and adding a creature to the GTS (Global Trade System).
 *
 * @param data - The data received from the client, expected to contain creature and require_condition information.
 * @param ws - The WebSocket connection of the client.
 * @returns An object indicating the success or failure of the operation, along with a message.
 *
 * @remarks
 * - Validates the incoming data using `GtsAddData.safeParse`.
 * - Retrieves the player ID associated with the WebSocket connection.
 * - Attempts to add the creature to the GTS using the `Gts.addToGTS` method.
 * - Catches and logs any errors that occur during the process.
 */
const gtsAddHandler = createEventHandler('gtsAdd', async (data, ws) => {

  const validatedData = GtsAddData.safeParse(data);

  if (!validatedData.success) {
    return { success: false, message: 'Invalid creature or conditions data' };
  }

  const player = server.getClientId(ws);

  if (!player) {
    return { success: false, message: 'Player not found' };
  }

  try {
    const result = await Gts.addToGTS(
      player,
      validatedData.data.creature,
      validatedData.data.require_conditions
    );
    return result;
  } catch (error) {
    console.error('Error adding creature to GTS:', error);
    return { success: false, message: 'Failed to adding in creature to GTS' };
  }
});

export default gtsAddHandler;
