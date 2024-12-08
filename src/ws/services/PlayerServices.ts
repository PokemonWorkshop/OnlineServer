import { Socket } from 'socket.io';
import { IPlayer, Player } from '@models/Player';
import { HttpStatusCode, SocketResponse } from './SocketServices';

interface HandshakeData {
  playerId: string;
}

/**
 * Deletes players who have not connected within the specified number of days.
 * Also removes these players from the friends lists of other players.
 *
 * @param days - The number of days of inactivity before deleting a player, or -1 to skip deletion.
 * @returns A promise that resolves to the number of deleted players.
 */
async function removeMultiplePlayers(days: number): Promise<number> {
  try {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - days);

    const playersToRemove = await Player.find({
      lastConnection: { $lt: currentDate },
    }).select('playerId');

    const playerIdsToRemove = playersToRemove.map((player) => player.playerId);

    if (playerIdsToRemove.length === 0) {
      return 0;
    }

    const res = await Player.deleteMany({
      playerId: { $in: playerIdsToRemove },
    });

    await Player.updateMany(
      { friends: { $in: playerIdsToRemove } },
      { $pull: { friends: { $in: playerIdsToRemove } } }
    );

    return res.deletedCount;
  } catch (error) {
    console.error(
      `Error deleting expired account players and updating friends list: ${error}`
    );
    throw error;
  }
}

/**
 * Finds a player by playerId or creates a new player if one does not exist.
 *
 * @param playerId - The unique ID of the player to find or create.
 * @param playerName - The username to assign if creating a new player.
 * @returns A promise that resolves to the player document.
 */
async function ensurePlayer(
  playerId: string,
  playerName: string,
  playingGirl?: boolean,
  charsetBase?: string
): Promise<IPlayer> {
  try {
    const player = await Player.findOneAndUpdate(
      { playerId },
      {
        $setOnInsert: {
          playerName,
          isOnline: true,
          playingGirl: playingGirl ?? false,
          charsetBase: charsetBase ?? '',
        },
      },
      { upsert: true, new: true }
    ).exec();
    return player;
  } catch (error) {
    throw error;
  }
}

/**
 * Retrieves a player from the database by their playerId.
 *
 * @param playerId - The unique ID of the player to find.
 * @returns A promise that resolves to the player document if found, or null if no player is found.
 */
async function getPlayerById(playerId: string): Promise<IPlayer | null> {
  try {
    const player = await Player.findOne({ playerId }).exec();
    return player;
  } catch (error) {
    console.error(`Error fetching player: ${error}`);
    throw error;
  }
}

/**
 * Updates the username of a player in the database.
 *
 * @param playerId - The unique ID of the player whose username is to be updated.
 * @param playerName - The new username to set for the player.
 * @returns A promise that resolves to the updated player document if successful, or null if no player is found.
 */
async function updateUsername(
  playerId: string,
  playerName: string
): Promise<IPlayer | null> {
  try {
    const player = await Player.findOneAndUpdate(
      { playerId },
      { playerName },
      { new: true }
    ).exec();
    return player;
  } catch (error) {
    console.error(`Error updating username for playerId ${playerId}: ${error}`);
    throw error;
  }
}

/**
 * Updates the online status of a player in the database and sets the last connection time.
 *
 * @param playerId - The unique ID of the player whose status is to be updated.
 * @param isOnline - The new online status to set for the player (true or false).
 * @returns A promise that resolves to the updated player document if successful, or null if no player is found.
 *
 * @remarks
 * - The `lastConnection` field is updated to the current date and time every time this function is called.
 * - The function uses `findOneAndUpdate` to perform the update and return the updated document.
 * - The `{ new: true }` option ensures that the returned document reflects the latest update.
 */
async function setOnlineStatus(
  playerId: string,
  isOnline: boolean
): Promise<IPlayer | null> {
  try {
    // Create the update object with the new online status and current date for lastConnection
    const update: { isOnline: boolean; lastConnection: Date } = {
      isOnline,
      lastConnection: new Date(),
    };

    // Perform the update and return the updated player document
    const player = await Player.findOneAndUpdate(
      { playerId },
      update,
      { new: true } // Ensures that the updated document is returned
    ).exec();

    return player;
  } catch (error) {
    console.error(`Error updating player status: ${error}`);
    throw error;
  }
}

/**
 * Deletes a player from the database and removes the player from the friends lists of other players.
 *
 * @param playerId - The unique ID of the player to delete.
 * @returns A promise that resolves to the deleted player document if successful, or null if no player is found.
 */
async function deletePlayer(playerId: string): Promise<IPlayer | null> {
  try {
    const deletedPlayer = await Player.findOneAndDelete({ playerId }).exec();

    if (!deletedPlayer) {
      return null;
    }

    await Player.updateMany(
      { friends: playerId },
      { $pull: { friends: playerId } }
    ).exec();

    return deletedPlayer;
  } catch (error) {
    throw error;
  }
}

/**
 * Player Relationship Functions
 *
 * These functions handle the friend relationship between players.
 */

/**
 * Checks the relationship and status between two players.
 *
 * This function verifies if both players exist, if they are already friends,
 * or if there is an existing friend request between them.
 *
 * @param {string} playerId - The unique ID of the player sending the friend request.
 * @param {Object} opts - Options object containing either friendCode or secondplayerId.
 * @param {string} [opts.friendCode] - The friend's code, used to identify the player receiving the request.
 * @param {string} [opts.secondplayerId] - Alternative way to identify the friend by their playerId.
 * @returns {Promise<{ status: boolean, message: string, receiver?: IPlayer, requester?: IPlayer }>}
 */
async function checkFriendPlayer(
  playerId: string,
  opts: { friendCode?: string; secondplayerId?: string } = {}
): Promise<{
  status: boolean;
  message: string;
  code: HttpStatusCode;
  receiver?: IPlayer;
  requester?: IPlayer;
}> {
  const { friendCode, secondplayerId } = opts;

  try {
    if (!friendCode && !secondplayerId) {
      return {
        status: false,
        code: HttpStatusCode.BadRequest,
        message: 'Friend code or other player ID must be provided',
      };
    }

    const query = secondplayerId
      ? { playerId: secondplayerId }
      : { friendCode };

    const [receiver, requester] = await Promise.all([
      Player.findOne(query).exec(),
      Player.findOne({ playerId }).exec(),
    ]);

    if (!receiver || !requester) {
      return {
        status: false,
        code: HttpStatusCode.NotFound,
        message: 'One or both players not found',
      };
    }

    if (
      receiver.friends.includes(requester.playerId) ||
      requester.friends.includes(receiver.playerId)
    ) {
      return {
        status: false,
        code: HttpStatusCode.Conflict,
        message: 'Already friends',
      };
    }

    return {
      status: true,
      code: HttpStatusCode.OK,
      message: 'Validation passed',
      receiver,
      requester,
    };
  } catch (error) {
    console.error(`Error validating friend status: ${error}`);
    return {
      status: false,
      code: HttpStatusCode.InternalServerError,
      message: 'An error occurred during validation',
    };
  }
}

/**
 * Adds a player as a friend to another player and updates both players' friends lists accordingly.
 *
 * @param requesterId - The playerId of the player sending the friend request.
 * @param receiverId - The playerId of the player receiving the friend request.
 * @returns A promise that resolves to an object indicating the success or failure of the operation.
 */
async function addFriendPlayer(
  requesterId: string,
  receiverId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const players = await Player.find({
      playerId: { $in: [requesterId, receiverId] },
    }).exec();

    if (players.length !== 2) {
      return { success: false, message: 'One or both players not found' };
    }

    const [requester, receiver] = players;

    if (
      requester.friends.includes(receiverId) ||
      receiver.friends.includes(requesterId)
    ) {
      return { success: false, message: 'Already friends' };
    }

    await Promise.all([
      Player.updateOne(
        { playerId: requesterId },
        { $addToSet: { friends: receiverId } }
      ).exec(),
      Player.updateOne(
        { playerId: receiverId },
        { $addToSet: { friends: requesterId } }
      ).exec(),
    ]);

    return { success: true, message: 'Friend request accepted' };
  } catch (error) {
    console.error(`Error adding friend: ${error}`);
    return { success: false, message: `Error adding friend` };
  }
}

/**
 * Removes a player from another player's friends list and vice versa.
 *
 * @param requesterId - The playerId of the player requesting the removal of a friend.
 * @param receiverId - The playerId of the player to be removed from the friends list.
 * @returns A promise that resolves to an object indicating the success or failure of the operation.
 */
async function removeFriendPlayer(
  requesterId: string,
  friendId: string
): Promise<SocketResponse> {
  try {
    const players = await Player.find(
      { playerId: { $in: [requesterId, friendId] } },
      { playerId: 1, friends: 1 }
    ).exec();

    if (players.length !== 2) {
      return {
        success: false,
        status: {
          code: HttpStatusCode.NotFound,
          message: 'One or both players not found',
        },
      };
    }

    const requester = players.find((p) => p.playerId === requesterId);
    const friend = players.find((p) => p.playerId === friendId);

    if (
      !requester?.friends.includes(friendId) ||
      !friend?.friends.includes(requesterId)
    ) {
      return {
        success: false,
        status: {
          code: HttpStatusCode.Conflict,
          message: 'Players are not friends',
        },
      };
    }

    await Player.updateMany(
      { playerId: { $in: [requesterId, friendId] } },
      { $pull: { friends: { $in: [requesterId, friendId] } } }
    );

    return {
      success: true,
      status: {
        code: HttpStatusCode.OK,
        message: 'Friend removed successfully',
      },
    };
  } catch (error) {
    console.error(`Error removing friend: ${error}`);
    return {
      success: false,
      status: {
        code: HttpStatusCode.InternalServerError,
        message: 'Error removing friend',
      },
      details: { error: error },
    };
  }
}

/*async function removeFriendPlayer(
  requesterId: string,
  friendId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const players = await Player.find({
      playerId: { $in: [requesterId, friendId] },
    }).exec();

    if (players.length !== 2) {
      return { success: false, message: 'One or both players not found' };
    }

    const [requester, receiver] = players;

    if (
      !requester.friends.includes(friendId) ||
      !receiver.friends.includes(requesterId)
    ) {
      return { success: false, message: 'Not friends' };
    }

    await Promise.all([
      Player.updateOne(
        { playerId: requesterId },
        { $pull: { friends: friendId } }
      ).exec(),
      Player.updateOne(
        { playerId: friendId },
        { $pull: { friends: requesterId } }
      ).exec(),
    ]);

    return { success: true, message: 'Friend removed successfully' };
  } catch (error) {
    console.error(`Error removing friend: ${error}`);
    return { success: false, message: `Error removing friend` };
  }
}*/

/**
 * Retrieves the list of friends for a given player, including their IDs and usernames.
 *
 * @param playerId - The unique ID of the player whose friends list is to be retrieved.
 * @returns A promise that resolves to an array of objects, each containing the ID, username,
 *          online status, gender, and friend code of a friend.
 */
async function getFriendsList(playerId: string): Promise<
  {
    playerId: string;
    playerName: string;
    isOnline: boolean;
    playingGirl: boolean;
    friendCode: string;
  }[]
> {
  try {
    const friendsList = await Player.aggregate([
      { $match: { playerId } },
      {
        $lookup: {
          from: 'players',
          localField: 'friends',
          foreignField: 'playerId',
          as: 'friendsDetails',
        },
      },
      { $unwind: '$friendsDetails' },
      {
        $project: {
          _id: 0,
          'friendsDetails.playerId': 1,
          'friendsDetails.playerName': 1,
          'friendsDetails.isOnline': 1,
          'friendsDetails.playingGirl': 1,
          'friendsDetails.friendCode': 1,
        },
      },
    ]).exec();

    return friendsList.length
      ? friendsList.map((doc) => doc.friendsDetails)
      : [];
  } catch (error) {
    console.error(
      `Error retrieving friends list for playerId ${playerId}: ${error}`
    );
    throw error;
  }
}
/*async function getFriendsList(
  playerId: string
): Promise<{ playerId: string; playerName: string }[]> {
  try {
    const player = await Player.findOne({ playerId }).exec();

    if (!player) {
      throw new Error(`Player with playerId ${playerId} not found`);
    }

    const friends = await Player.find(
      { playerId: { $in: player.friends } },
      'playerId playerName isOnline playingGirl friendCode'
    ).exec();

    const friendsList = friends.map((friend) => ({
      playerId: friend.playerId,
      playerName: friend.playerName,
      isOnline: friend.isOnline,
      playingGirl: friend.playingGirl,
      friendCode: friend.friendCode,
    }));

    return friendsList;
  } catch (error) {
    console.error(
      `Error retrieving friends list for playerId ${playerId}: ${error}`
    );
    throw error;
  }
}*/

/**
 * Player Connection Functions
 *
 * These functions deal with player connection status and handling player socket connections.
 */

/**
 * Extracts and validates the playerId from the socket handshake query.
 *
 * @param {Socket} socket - The socket instance to extract playerId from.
 * @param {boolean} [disconnect=false] - Optional flag to indicate whether to disconnect the socket if playerId is invalid.
 * @returns {Promise<string>} - A promise that resolves to the playerId if valid.
 * @throws {Error} - Throws an error if playerId is invalid.
 */
async function getPlayerId(
  socket: Socket,
  disconnect: boolean = false
): Promise<string> {
  const { playerId } = socket.handshake.query;

  if (typeof playerId === 'string') {
    return playerId;
  }

  if (disconnect) {
    socket.disconnect();
  }

  throw new Error('Invalid playerId');
}

/*async function getLangPlayer(socket: Socket): Promise<string> {
  const { playerLang } = socket.handshake.query;
  

}*/

/**
 * Extracts and validates playerId and playerName from the socket handshake query.
 *
 * This function retrieves the `playerId` and `playerName` from the socket's handshake query parameters and
 * ensures that both values are strings. If the values are valid, they are returned as an object.
 * If the values are invalid and the `disconnect` flag is set to `true`, the socket will be disconnected.
 * Otherwise, an error will be thrown indicating that the handshake data is invalid.
 *
 * @param {Socket} socket - The socket instance to extract data from.
 * @param {boolean} [disconnect=false] - Optional flag to indicate whether to disconnect the socket if the data is invalid.
 * @returns {Promise<HandshakeData>} - A promise that resolves to an object containing `playerId` and `playerName` if they are valid.
 * @throws {Error} - Throws an error if either `playerId` or `playerName` is invalid.
 */
async function getHandshakeData(
  socket: Socket,
  disconnect: boolean = false
): Promise<HandshakeData> {
  const { playerId } = socket.handshake.query;

  if (typeof playerId === 'string') {
    return { playerId };
  }

  if (disconnect) {
    socket.disconnect();
  }

  throw new Error('Invalid handshake data');
}

/**
 * Checks if a player is online.
 *
 * @param playerId - The unique ID of the player to check.
 * @returns A promise that resolves to the online status of the player (true or false).
 */
async function isPlayerOnline(playerId: string): Promise<boolean> {
  try {
    const player = await Player.findOne({ playerId }).exec();
    return player ? player.isOnline : false;
  } catch (error) {
    console.error(
      `Error checking online status for playerId ${playerId}: ${error}`
    );
    throw false;
  }
}

export {
  ensurePlayer,
  getPlayerById,
  updateUsername,
  setOnlineStatus,
  deletePlayer,
  checkFriendPlayer,
  addFriendPlayer,
  removeFriendPlayer,
  getFriendsList,
  getPlayerId,
  getHandshakeData,
  isPlayerOnline,
  removeMultiplePlayers,
};
