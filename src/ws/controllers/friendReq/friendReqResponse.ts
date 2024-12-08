import { Socket } from 'socket.io';
import { z } from 'zod';
import { addFriendPlayer, getPlayerId } from '@ws/services/PlayerServices';
import { removeFriendReq } from '@ws/services/FriendReqServices';

// Schema to validate the friend request response
const friendReqResponseSchema = z.object({
  requesterId: z.string(),
  isAccepted: z.boolean(),
});

/**
 * Validates the friend request response data using the Zod schema.
 *
 * @param {unknown} data - The data to be validated, expected to include 'requesterId' and 'isAccepted'.
 * @returns {Promise<{ success: boolean, message?: string, data?: { requesterId: string, isAccepted: boolean } }>} -
 * A promise that resolves to an object containing the validation result:
 * - `success`: Indicates whether the validation was successful.
 * - `message`: Provides an error message if validation fails.
 * - `data`: Contains the validated `requesterId` and `isAccepted` if validation is successful.
 */
async function validateFriendReqResponse(data: unknown): Promise<{
  success: boolean;
  message?: string;
  data?: { requesterId: string; isAccepted: boolean };
}> {
  // Validate the incoming data against the Zod schema
  const validationResult = await friendReqResponseSchema.safeParse(data);

  if (!validationResult.success) {
    // Return error details if validation fails
    return {
      success: false,
      message: `Invalid 'requesterId' and 'isAccepted' format: ${validationResult.error.message}`,
    };
  }

  // Return the validated data if successful
  return { success: true, data: validationResult.data };
}

/**
 * Emits a response via the socket with a standard format.
 *
 * @param {Socket} socket - The socket instance.
 * @param {boolean} success - Indicates whether the operation was successful or not.
 * @param {string} message - The message to be emitted.
 */
function emitResponse(socket: Socket, success: boolean, message: string): void {
  socket.emit('friendReqResponse', { success, message });
}

/**
 * Handles the logic for responding to a friend request.
 *
 * @param {Socket} socket - The socket instance.
 * @param {unknown} data - The data containing 'requesterId' and 'isAccepted'.
 */
export async function friendReqResponse(
  socket: Socket,
  data: unknown
): Promise<void> {
  // Validate the incoming data
  const validation = await validateFriendReqResponse(data);

  if (!validation.success) {
    emitResponse(socket, false, validation.message!);
    console.warn(
      `Validation error in friendReqResponse: ${validation.message}`
    );
    return;
  }

  const { requesterId, isAccepted } = validation.data!;

  try {
    // Retrieve the player ID associated with the socket
    const playerId = await getPlayerId(socket);

    if (!isAccepted) {
      // If the request is rejected, attempt to remove the friend request
      const removeRequest = await removeFriendReq(requesterId, playerId);

      // Handle failure to delete the request
      if (removeRequest === null) {
        emitResponse(socket, false, 'Error deleting friend request');
        console.warn('Error deleting friend request');
        return;
      }

      // Emit success response for rejected request
      emitResponse(
        socket,
        true,
        'Friend request rejected and removed successfully.'
      );
      return;
    }

    // If the request is accepted, add the friend
    const addPlayers = await addFriendPlayer(requesterId, playerId);

    // Handle failure to add the friend
    if (!addPlayers.success) {
      emitResponse(socket, false, `Error adding friend: ${addPlayers.message}`);
      console.warn(`Error adding friend: ${addPlayers.message}`);
      return;
    }

    // Remove the request after successfully adding the friend
    const removeRequest = await removeFriendReq(requesterId, playerId);

    // Handle failure to delete the request
    if (removeRequest === null) {
      emitResponse(socket, false, 'Error deleting friend request');
      console.warn('Error deleting friend request');
      return;
    }

    // Emit success response for accepted request
    emitResponse(
      socket,
      true,
      'Friend added and request removed successfully.'
    );
  } catch (error) {
    // Handle and log any errors that occur during the process
    emitResponse(
      socket,
      false,
      'Failed to process friend request. Please try again later.'
    );
    console.error(`Error in friendReqResponse: ${error}`);
  }
}
