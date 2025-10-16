import { server } from '@root/src';
import { z } from 'zod';
import createEventHandler from '@logic/createEventHandler';
import { Player } from '@root/src/models/player/player.model';

/**
 * Schema definition for validating player update data.
 *
 * This schema ensures that the `fields` property is a record where the keys are strings
 * and the values can be of any type (`unknown`).
 */
const PlayerUpdateData = z.record(z.string(), z.unknown());

/**
 * Handles the "playerUpdate" WebSocket event.
 *
 * This event is triggered when a player sends an update request. The handler
 * validates the incoming data, identifies the player associated with the WebSocket
 * connection, and updates the player's fields in the database.
 *
 * @param data - The data received from the WebSocket event. It is validated
 *               against the `PlayerUpdateData` schema.
 */
const playerUpdateHandler = createEventHandler(
  'playerUpdate',
  async (data, ws) => {
    const validatedData = PlayerUpdateData.safeParse(data);

    if (!validatedData.success) {
      return { success: false, message: 'Invalid player update data' };
    }

    const player = server.getClientId(ws);

    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    try {
      const result = await Player.updateFields(player, validatedData.data);
      return {
        success: true,
        message: 'Player updated successfully',
        data: result,
      };
    } catch (error) {
      console.error('Error updating player:', error);
      return { success: false, message: 'Failed to update player' };
    }
  }
);

export default playerUpdateHandler;
