import { Socket } from 'socket.io';
import { z } from 'zod';
import { checkFriendPlayer, getPlayerId } from '@ws/services/PlayerServices';
import { createFriendReq } from '@ws/services/FriendReqServices';
import { HttpStatusCode, SocketResponse } from '../../services/SocketServices';

const friendReqSchema = z.string();

/**
 * Handles the logic for adding a friend request.
 *
 * @param {Socket} socket - The socket instance.
 * @param {string} friendCode - The friend's code provided by the user.
 */
export async function friendReqAdd(
  socket: Socket,
  friendCode: string
): Promise<void> {
  const validationResult = friendReqSchema.safeParse(friendCode);
  if (!validationResult.success) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.BadRequest,
        message: 'Invalid parameters format',
      },
      details: {
        message: validationResult.error.message,
        providedData: friendCode,
      },
    };

    socket.emit('friendReqAdd', errorResponse);
    console.error(
      `Error friend request adding: ${validationResult.error.message}`
    );
    return;
  }

  try {
    const playerId = await getPlayerId(socket);

    const check = await checkFriendPlayer(playerId, {
      friendCode: validationResult.data,
    });

    if (!check.status) {
      const checkResponse: SocketResponse = {
        success: check.status,
        status: {
          code: check.code,
          message: check.message,
        },
      };
      socket.emit('friendReqAdd', checkResponse);
      console.warn(`Friend request failed: ${check.message}`);
      return;
    }

    const createReq = await createFriendReq(check.requester!, check.receiver!);

    if (!createReq.success) {
      const createReqResponse: SocketResponse = {
        success: createReq.success,
        status: {
          code: createReq.code,
          message: createReq.message,
        },
      };
      socket.emit('friendReqAdd', createReqResponse);
      console.warn(`Friend request creation failed: ${createReq.message}`);
      return;
    }

    const successResponse: SocketResponse = {
      success: createReq.success,
      status: {
        code: createReq.code,
        message: createReq.message,
      },
      data: [],
    };
    socket.emit('friendReqAdd', successResponse);
  } catch (error) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.InternalServerError,
        message: 'Failed to friend request. Please try again later.',
      },
      details: {
        error: error,
      },
    };
    socket.emit('friendReqAdd', errorResponse);
    console.error(`Error in friendReqAdd: ${error}`);
  }
}
