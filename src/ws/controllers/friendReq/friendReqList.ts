import { Socket } from 'socket.io';
import { getFriendsList, getPlayerId } from '@ws/services/PlayerServices';
import { pendingCountFriendReq } from '@ws/services/FriendReqServices';
import { HttpStatusCode, SocketResponse } from '@ws/services/SocketServices';

export async function friendReqList(socket: Socket) {
  try {
    const playerId = await getPlayerId(socket);

    const requestPending = await pendingCountFriendReq(playerId);
    const getFriends = await getFriendsList(playerId);

    const successResponse: SocketResponse = {
      success: true,
      status: {
        code: HttpStatusCode.OK,
        message: 'Friend requests and friends list retrieved successfully.',
      },
      data: {
        pending: requestPending,
        friends: getFriends,
      },
    };

    socket.emit('friendReqList', successResponse);
  } catch (error) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.InternalServerError,
        message: 'Failed to list friend. Please try again later',
      },
      details: {
        error: error,
      },
    };
    socket.emit('friendReqList', errorResponse);
    console.error(`Error list friend: ${error}`);
  }
}
