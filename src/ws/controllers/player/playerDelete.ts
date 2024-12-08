import { Socket } from 'socket.io';
import { deletePlayer, getPlayerId } from '@ws/services/PlayerServices';
import { HttpStatusCode, SocketResponse } from '@ws/services/SocketServices';

/**
 * Function to handle the deletion of a player.
 *
 * This function validates the playerId, attempts to delete the player,
 * and emits the appropriate response back to the client based on the result.
 *
 * @param {Socket} socket - The socket instance representing the client connection.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export async function playerDelete(socket: Socket): Promise<void> {
  try {
    const playerId = await getPlayerId(socket);

    const player = await deletePlayer(playerId);

    if (player === null) {
      const errorResponse: SocketResponse = {
        success: false,
        status: {
          code: HttpStatusCode.NotFound,
          message: 'Player not found',
        },
        details: { playerId },
      };
      socket.emit('playerDelete', errorResponse);
      return;
    }

    const successResponse: SocketResponse = {
      success: true,
      status: {
        code: HttpStatusCode.OK,
        message: `The player ${playerId} has been successfully removed.`,
      },
      data: player,
    };
    socket.emit('playerDelete', successResponse);
  } catch (error) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.InternalServerError,
        message: 'Failed to delete player. Please try again later.',
      },
      details: {
        error: error,
      },
    };

    socket.emit('playerDelete', errorResponse);
    console.error(`Error deleting player: ${error}`);
  }
}
