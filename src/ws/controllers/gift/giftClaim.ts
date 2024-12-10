import { checkCode, claimGift } from '@ws/services/GiftServices';
import { getPlayerId } from '@ws/services/PlayerServices';
import { HttpStatusCode, SocketResponse } from '@ws/services/SocketServices';
import { Socket } from 'socket.io';
import { z } from 'zod';

/**
 * Schema for validating the gift claim data.
 *
 * This schema ensures that exactly one of 'code' or 'giftId' is provided, and not both.
 */
const giftClaimSchemaData = z
  .object({
    code: z.string().optional(),
    giftId: z.string().optional(),
  })
  .refine((data) => data.code || data.giftId, {
    message: "Either 'code' or 'giftId' must be provided, but not both.",
  })
  .refine((data) => !(data.code && data.giftId), {
    message: "Only one of 'code' or 'giftId' can be provided.",
  });

/**
 * Handles the gift claiming process based on provided data.
 *
 * This function validates the claim data, retrieves the player's ID, and processes the gift claim.
 * It uses either the 'code' or 'giftId' to find and claim the gift.
 *
 * @param {Socket} socket - The Socket.IO socket instance used for communication.
 * @param {Object} data - The data object containing either a 'code' or a 'giftId'.
 * @param {string} [data.code] - Optional code for claiming the gift.
 * @param {string} [data.giftId] - Optional gift ID for claiming the gift.
 *
 * @returns {Promise<void>} - A promise that resolves when the process completes.
 */
export async function giftClaim(socket: Socket, data: unknown): Promise<void> {
  const validationResult = giftClaimSchemaData.safeParse(data);
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

    socket.emit('giftClaim', errorResponse);

    console.error(`Error claiming gift: ${validationResult.error.message}`);
    return;
  }

  const parseData = validationResult.data;

  try {
    const playerId = await getPlayerId(socket);

    let giftId: string;

    if (parseData.code) {
      const codeChecked = await checkCode(parseData.code);

      if (!codeChecked.success) {
        const codeErrorResponse: SocketResponse = {
          success: false,
          status: {
            code: HttpStatusCode.NotFound,
            message: 'Invalid gift code',
          },
          details: {
            message:
              'The provided gift code is invalid or does not match any gift.',
          },
        };

        socket.emit('giftClaim', codeErrorResponse);
        return;
      }
      giftId = codeChecked.giftId!;
    } else {
      giftId = parseData.giftId!;
    }

    const claimedGift = await claimGift(giftId, playerId);

    const successResponse: SocketResponse = claimedGift;

    socket.emit('giftClaim', successResponse);
  } catch (error) {
    const errorResponse: SocketResponse = {
      success: false,
      status: {
        code: HttpStatusCode.InternalServerError,
        message: 'Failed to claim gift. Please try again later.',
      },
      details: {
        error: error,
      },
    };
    socket.emit('giftClaim', errorResponse);
    console.error(`Error claiming gift: ${error}`);
  }
}
