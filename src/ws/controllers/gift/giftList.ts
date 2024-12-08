import { getListAvailableGift } from '@ws/services/GiftServices';
import { getPlayerId } from '@ws/services/PlayerServices';
import { Socket } from 'socket.io';
import { HttpStatusCode, SocketResponse } from '@ws/services/SocketServices';

export async function giftList(socket: Socket): Promise<void> {
  try {
    const playerId = await getPlayerId(socket);

    const availableGifts = await getListAvailableGift(playerId);

    const successResponse: SocketResponse = {
      success: true,
      status: {
        code: HttpStatusCode.OK,
        message: `List of available gifts for collection without a code (${availableGifts.length})`,
      },
      data: availableGifts,
    };

    socket.emit('giftList', successResponse);
  } catch (error) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.InternalServerError,
        message: 'Failed to list gift. Please try again later.',
      },
      details: {
        error: error,
      },
    };
    socket.emit('giftList', errorResponse);
    console.error(`Error list gift: ${error}`);
  }
}
