import { Socket } from 'socket.io';
import { getPlayerId } from '@ws/services/PlayerServices';
import { pendingListFriendReq } from '@ws/services/FriendReqServices';
import { HttpStatusCode, SocketResponse } from '@ws/services/SocketServices';

export async function friendReqListPending(socket: Socket) {
  try {
    const playerId = await getPlayerId(socket);

    const requestPending = await pendingListFriendReq(playerId);

    const successResponse: SocketResponse = {
      success: true,
      status: {
        code: HttpStatusCode.OK,
        message: 'Pending friend requests retrieved successfully.',
      },
      data: requestPending,
    };

    socket.emit('friendReqListPending', successResponse);
  } catch (error) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.InternalServerError,
        message:
          'Failed to retrieve pending friend requests. Please try again later.',
      },
      details: {
        error: error,
      },
    };
    socket.emit('friendReqList', errorResponse);
    console.error(`Error retrieving pending friend requests: ${error}`);
  }
}
