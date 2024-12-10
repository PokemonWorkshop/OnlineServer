import { Socket } from 'socket.io';
import { z } from 'zod';
import { getPlayerId, removeFriendPlayer } from '@ws/services/PlayerServices';
import { HttpStatusCode, SocketResponse } from '../../services/SocketServices';

// Schema to validate the friendCode input
const friendReqRemoveSchema = z.string();

export async function friendReqRemove(
  socket: Socket,
  friendId: string
): Promise<void> {
  const validationResult = friendReqRemoveSchema.safeParse(friendId);
  if (!validationResult.success) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.BadRequest,
        message: 'Invalid parameters format',
      },
      details: {
        message: validationResult.error.message,
        providedData: friendId,
      },
    };
    socket.emit('friendReqRemove', errorResponse);
    console.error(`Error removing friend: ${validationResult.error.message}`);
    return;
  }

  const friend = validationResult.data;

  try {
    const playerId = await getPlayerId(socket);

    const action = await removeFriendPlayer(playerId, friend);

    socket.emit('friendReqRemove', action);
  } catch (error) {
    socket.emit('friendReqRemove', error);
    console.error(`Error in friendReqRemove: ${error}`);
  }
}
