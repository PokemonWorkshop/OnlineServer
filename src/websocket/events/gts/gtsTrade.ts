import { z } from 'zod';
import createEventHandler from '@logic/createEventHandler';
import { Gts } from '@models/gts';
import { server } from '@root/src';

/**
 * Schema de validation pour le trade.
 */
const GtsTradeData = z.object({
  playerA_id: z.string(),
  offeredCreature: z.object({
    species: z.string(),
    level: z.number(),
    shiny: z.boolean(),
    form: z.number(),
    nature: z.number(),
    data: z.string(),
  }),
});

/**
 * Handles the 'gtsTrade' event.
 * This event allows player B to propose a trade with player A's deposited Pokémon.
 *
 * @param data - The trade data containing playerA_id and offeredCreature.
 * @param ws - The WebSocket connection of the client (player B).
 * @returns An object indicating the success or failure of the trade.
 */
const gtsTradeHandler = createEventHandler('gtsTrade', async (data, ws) => {
  const validatedData = GtsTradeData.safeParse(data);

  if (!validatedData.success) {
    console.error(validatedData.error);

    return { success: false, message: 'Invalid trade data.' };
  }

  const playerB_id = server.getClientId(ws);
  if (!playerB_id) {
    return { success: false, message: 'Player not found.' };
  }

  try {
    const tradeResult = await Gts.tradeWithOffer(
      validatedData.data.playerA_id,
      validatedData.data.offeredCreature
    );

    return tradeResult;
  } catch (error) {
    console.error('Error processing trade:', error);
    return {
      success: false,
      message: 'Trade failed due to an unexpected error.',
    };
  }
});

export default gtsTradeHandler;
