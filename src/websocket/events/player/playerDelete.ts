import createEventHandler from '@logic/createEventHandler';
import { Player } from '@root/src/models/player';
import { server } from '@src/index';

/**
 * Handles the 'playerDelete' event.
 *
 * @param event - The name of the event.
 * @param handler - The asynchronous function to handle the event.
 * @returns An object indicating the success or failure of the player deletion operation.
 */
const playerDeleteHandler = createEventHandler(
  'playerDelete',
  async (_, ws) => {
    const playerId = server.getClientId(ws);

    if (!playerId) {
      return { success: false, message: 'Player not found' };
    }

    try {
      const { success, message } = await Player.removePlayer(playerId);

      return { success, message };
    } catch (error) {
      console.error('Error deleting player:', error);
      return { success: false, message: 'Failed to delete player' };
    }
  }
);

export default playerDeleteHandler;
