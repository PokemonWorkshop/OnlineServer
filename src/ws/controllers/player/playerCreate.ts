import { Socket } from 'socket.io';
import { z } from 'zod';
import { ensurePlayer } from '@ws/services/PlayerServices';
import { HttpStatusCode, SocketResponse } from '../../services/SocketServices';

// Define the schema for validating player data using Zod
const playerCreateDataSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  playingGirl: z.boolean(),
  charsetBase: z.string(),
});
/**
 * Handles the creation of a player.
 * @param socket - The Socket.IO socket instance used to communicate with the client.
 * @param data - The raw data received from the client, expected to include player ID and player name.
 * @returns A promise that resolves when the operation is complete.
 */
export async function playerCreate(
  socket: Socket,
  data: unknown
): Promise<void> {
  const validationResult = playerCreateDataSchema.safeParse(data);
  if (!validationResult.success) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.UnprocessableEntity,
        message: 'Invalid parameters format',
      },
      details: {
        message: validationResult.error.message,
        providedData: data,
      },
    };
    socket.emit('playerCreate', errorResponse);
    return;
  }

  const { playerId, playerName, playingGirl, charsetBase } =
    validationResult.data;

  try {
    const player = await ensurePlayer(
      playerId,
      playerName,
      playingGirl,
      charsetBase
    );

    const successResponse: SocketResponse = {
      success: true,
      status: {
        code: HttpStatusCode.OK,
        message: 'Player creating successfully!',
      },
      data: player.friendCode,
    };

    socket.emit('playerCreate', successResponse);
  } catch (error) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.InternalServerError,
        message: 'Failed to create player. Please try again later.',
      },
      details: {
        error: error,
      },
    };
    socket.emit('playerCreate', errorResponse);
    console.error(`Error creating player: ${error}`);
  }
}
