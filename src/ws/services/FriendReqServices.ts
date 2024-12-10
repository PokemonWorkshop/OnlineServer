import { FriendReq, IFriendReq } from '@models/FriendReq';
import { IPlayer } from '@models/Player';
import { HttpStatusCode } from './SocketServices';

/**
 * Deletes friend requests that are older than a specified number of days.
 * If -1 is passed, no friend requests are deleted.
 *
 * @param days - The number of days to check for expired friend requests, or -1 to skip deletion.
 * @returns A promise that resolves to the number of deleted friend requests.
 */
async function removeMultipleFriendReq(days: number): Promise<number> {
  // If days is less than 0, ignore the deletion operation
  if (days < 0) return 0;

  try {
    // Calculate the expiration date by subtracting the specified number of days from the current date
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - days);

    // Delete all friend requests that were created before the calculated expiration date
    const res = await FriendReq.deleteMany({
      createdAt: { $lt: currentDate },
    });

    // Return the number of deleted friend requests
    return res.deletedCount;
  } catch (error) {
    // Log the error and throw it for further handling
    console.error(`Error deleting expired friend requests: ${error}`);
    throw error;
  }
}

/**
 * Deletes a specific friend request between a requester and a receiver.
 *
 * This function finds and deletes the friend request in the `FriendReq` collection
 * where the requester and receiver IDs match the provided parameters.
 *
 * @param {string} requesterId - The ID of the player who sent the friend request.
 * @param {string} receiverId - The ID of the player who received the friend request.
 * @returns {Promise<IFriendReq | null>} - A promise that resolves to the deleted friend request document or null if no request was found.
 * @throws {Error} - Throws an error if the operation fails.
 */
async function removeFriendReq(
  requesterId: string,
  receiverId: string
): Promise<IFriendReq | null> {
  try {
    // Find and delete the friend request that matches the provided requester and receiver IDs
    const requester = await FriendReq.findOneAndDelete({
      requesterId,
      receiverId,
    }).exec();

    // If no request is found, return null
    if (!requester) {
      return null;
    }

    // Return the deleted friend request document
    return requester;
  } catch (error) {
    // Log the error and throw it for further handling
    console.error(`Error deleting friend request: ${error}`);
    throw error;
  }
}

/**
 * Creates a new friend request between two players.
 *
 * This function takes the `requester` (the player sending the friend request) and `receiver` (the player
 * receiving the request). It checks if there is an existing friend request between the two players and
 * ensures that no request is currently in progress. If no friend request exists, a new request is created
 * and saved in the database.
 *
 * @param {IPlayer} requester - The player object representing the player sending the friend request.
 * @param {IPlayer} receiver - The player object representing the player receiving the friend request.
 * @returns {Promise<{ success: boolean; message: string }>} - A promise that resolves to an object indicating
 * whether the request was successfully created or not. The object contains a `success` flag and a corresponding `message`.
 * @throws {Error} - Throws an error if the operation fails due to any database or other issues.
 */
async function createFriendReq(
  requester: IPlayer,
  receiver: IPlayer
): Promise<{ success: boolean; code: HttpStatusCode; message: string }> {
  try {
    // Check if a friend request between the two players already exists (in either direction)
    const existingRequest = await FriendReq.findOne({
      $or: [
        { requesterId: requester.playerId, receiverId: receiver.playerId },
        { requesterId: receiver.playerId, receiverId: requester.playerId },
      ],
    }).exec();

    // If an existing request is found, return a failure message
    if (existingRequest) {
      return {
        success: false,
        code: HttpStatusCode.Conflict,
        message: 'Friend request already in progress',
      };
    }

    // Create a new friend request and save it to the database
    await FriendReq.create({
      requesterId: requester.playerId,
      requesterName: requester.playerName,
      receiverId: receiver.playerId,
    });

    // Return a success message if the request was created successfully
    return {
      success: true,
      code: HttpStatusCode.OK,
      message: 'Friend request sent successfully',
    };
  } catch (error) {
    // Log the error and return a generic failure message
    console.error(`Error creating friend request: ${error}`);
    return {
      success: false,
      code: HttpStatusCode.InternalServerError,
      message: 'An error occurred',
    };
  }
}

async function pendingCountFriendReq(playerId: String): Promise<number> {
  try {
    const existingRequest = await FriendReq.countDocuments({
      receiverId: playerId,
    }).exec();

    return existingRequest != null ? existingRequest : 0;
  } catch (error) {
    console.error(`Error get list request pending: ${error}`);
    return 0;
  }
}

async function pendingListFriendReq(playerId: String): Promise<IFriendReq[]> {
  try {
    const availableFriendReq = await FriendReq.find({
      receiverId: playerId,
    })
      .select('requesterId requesterUserName')
      .exec();

    return availableFriendReq;
  } catch (error) {
    console.error(`Error fetching available request friend: ${error}`);
    throw error;
  }
}

export {
  removeMultipleFriendReq,
  createFriendReq,
  removeFriendReq,
  pendingCountFriendReq,
  pendingListFriendReq,
};
