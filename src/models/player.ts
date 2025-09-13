import { Schema, Document, model, Model } from 'mongoose';

/**
 * Represents a friend request sent by a user.
 *
 * @interface FriendRequest
 * @property {string} from - The username or identifier of the user who sent the friend request.
 * @property {Date} date - The date and time when the friend request was sent.
 */
interface FriendRequest {
  from: string;
  date: Date;
}

/**
 * Represents a player in the system.
 *
 * @interface IPlayer
 * @extends Document
 *
 * @property {string} id - The unique identifier for the player.
 * @property {string} name - The name of the player.
 * @property {boolean} [isGirl] - Optional flag indicating if the player is a girl.
 * @property {string} [charsetBase] - Optional base character set for the player.
 * @property {string} [greeting] - Optional greeting message for the player.
 * @property {string} friendCode - The unique friend code of the player.
 * @property {string[]} friends - A list of friend IDs associated with the player.
 * @property {FriendRequest[]} friendRequests - A list of friend requests received by the player.
 * @property {Date} lastConnection - The timestamp of the player's last connection.
 * @property {boolean} isConnect - Indicates if the player is currently connected.
 * @property {boolean} isLinked - Indicates if the player is linked to another account or service.
 */
interface IPlayer extends Document {
  id: string;
  name: string;
  isGirl?: boolean;
  charsetBase: string;
  greeting: string;
  friendCode: string;
  friends: string[];
  friendRequests: FriendRequest[];
  lastConnection: Date;
  isConnect: boolean;
  isLinked: boolean;
}

/**
 * Interface representing the player model.
 * Extends the base Model interface with additional player-specific methods.
 */
interface IPlayerModel extends Model<IPlayer> {
  /**
   * Ensures that a player exists with the given data.
   * If the player does not exist, it will be created.
   *
   * @param playerData - Partial data of the player to ensure.
   * @returns A promise that resolves to an object containing:
   * - `success`: A boolean indicating if the operation was successful.
   * - `player`: The player object if the operation was successful.
   * - `message`: An optional message providing additional information.
   */
  ensurePlayer(
    playerData: Partial<IPlayer>
  ): Promise<{ success: boolean; player?: IPlayer; message?: string }>;

  /**
   * Sets the connection status of a player.
   *
   * @param playerId - The ID of the player whose connection status is to be set.
   * @param isConnected - A boolean indicating the player's connection status.
   * @returns A promise that resolves to the updated player object.
   */
  setPlayerConnectionStatus(
    playerId: string,
    isConnected: boolean
  ): Promise<IPlayer>;

  /**
   * Sets the linked status of a player.
   *
   * @param playerId - The unique identifier of the player.
   * @param isLinked - A boolean indicating whether the player is linked (true) or not (false).
   * @returns A promise that resolves to the updated player object.
   */
  setPlayerLinkedStatus(playerId: string, isLinked: boolean): Promise<IPlayer>;

  /**
   * Sends a friend request from one player to another.
   *
   * @param {string} fromId - The ID of the player sending the friend request.
   * @param {string} toFriendCode - The friend code of the player receiving the request.
   * @returns {Promise<{ success: boolean; message: string }>} - An object indicating the success of the operation and a message.
   */
  sendFriendRequest(
    fromId: string,
    toFriendCode: string
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Accepts a friend request between two users.
   *
   * @param receiverId - The ID of the user receiving the friend request.
   * @param senderId - The ID of the user who sent the friend request.
   * @returns A promise that resolves to an object indicating the success status and a message.
   */
  acceptedFriendRequest(
    receiverId: string,
    senderId: string
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Declines a friend request between two users.
   *
   * @param receiverId - The ID of the user receiving the friend request.
   * @param senderId - The ID of the user who sent the friend request.
   * @returns A promise that resolves to an object indicating the success status and a message.
   */
  declineFriendRequest(
    receiverId: string,
    senderId: string
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Removes a friend connection between two users.
   *
   * @param playerId - The ID of the user initiating the removal.
   * @param friendId - The ID of the friend to be removed.
   * @returns A promise that resolves to an object indicating the success status and a message.
   */
  removeFriend(
    playerId: string,
    friendId: string
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Removes old friend requests from all players, based on age in days.
   *
   * @param {number} days - Number of days after which requests are considered expired.
   * @returns {Promise<number>} - Number of requests removed in total.
   */
  clearOldFriendRequests(days: number): Promise<number>;

  /**
   * Deletes multiple documents from the collection where the `lastConnection` field
   * is less than or equal to the current time.
   *
   * @returns {Promise<number>} A promise that resolves to the result of the delete operation.
   */
  clearExpiredPlayers(days: number): Promise<number>;

  /**
   * Retrieves a list of pending items based on the provided `from`.
   * The query filters the items by their `id` and selects only the `id`, `name`,
   * and `friendCode` fields from the result.
   *
   * @constant
   * @type {Promise<Array<{ id: string; name: string; friendCode: string }>>>}
   * @description This operation is asynchronous and returns a promise that resolves
   * to an array of objects containing the selected fields.
   */
  getPendingFriendRequest(
    playerId: string
  ): Promise<{ id: string; name: string; friendCode: string }[]>;

  /**
   * Retrieves a list of friends for the current player based on their friend IDs.
   *
   * @remarks
   * - This method performs a database query to find all friends whose IDs match the ones
   *   in the `player.friends` array.
   * - The query uses the `$in` operator to filter the results efficiently.
   * - Only the `id`, `name`, and `friendCode` fields are selected for each friend.

   * @returns A promise that resolves to an array of friend objects containing the selected fields.
   */
  getFriendList(
    playerId: string
  ): Promise<{ id: string; name: string; friendCode: string }[]>;

  /**
   * Removes a player and cleans up any friend references or requests to/from them.
   *
   * @param playerId - The ID of the player to be removed.
   * @returns A promise that resolves with the result of the operation.
   */
  removePlayer(
    playerId: string
  ): Promise<{ success: boolean; message: string }>;

  /**
   * Updates multiple fields of a player document in the database.
   *
   * @param playerId - The unique identifier of the player.
   * @param fields - An object containing the fields and their new values to update.
   * @returns A promise that resolves to the updated player document.
   */
  updateFields(playerId: string, fields: Partial<IPlayer>): Promise<IPlayer>;
}

/**
 * Schema definition for the Player model.
 *
 * @typedef {Object} IPlayer
 * @property {string} id - Unique identifier for the player. Required and must be unique.
 * @property {string} name - Name of the player. Required.
 * @property {boolean} isGirl - Indicates if the player is a girl. Defaults to true.
 * @property {string} [charsetBase] - Optional charset base for the player.
 * @property {string} [greeting] - Optional greeting message for the player.
 * @property {string} friendCode - Unique friend code for the player. Defaults to a random string.
 * @property {string[]} friends - List of friend IDs. Defaults to an empty array.
 * @property {Date} lastConnection - Timestamp of the player's last connection. Defaults to the current date and time.
 * @property {boolean} isConnect - Indicates if the player is currently connected. Defaults to false.
 */
const SPlayer = new Schema<IPlayer>({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  name: { type: String, required: true },
  isGirl: { type: Boolean },
  charsetBase: { type: String, default: '' },
  greeting: { type: String, default: '' },
  friendCode: {
    type: String,
    default: function () {
      return Math.random().toString(36).substring(2, 10);
    },
    unique: true,
  },
  friends: { type: [String], default: [] },
  friendRequests: {
    type: [
      {
        from: String,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    default: [],
  },
  lastConnection: { type: Date, default: Date.now },
  isConnect: { type: Boolean, default: false },
  isLinked: { type: Boolean, default: false },
});

SPlayer.statics.ensurePlayer = async function (
  playerData: Partial<IPlayer>
): Promise<{ success: boolean; player?: IPlayer; message?: string }> {
  const existingPlayer = await this.exists({ id: playerData.id });

  if (existingPlayer) {
    return { success: false, message: 'Player already exists' };
  }

  try {
    const newPlayer = await this.create(playerData);
    return {
      success: true,
      player: newPlayer,
      message: 'Player created successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Error creating player: ${error}`,
    };
  }
};

SPlayer.statics.setPlayerConnectionStatus = async function (
  playerId: string,
  isConnected: boolean
): Promise<IPlayer> {
  return this.findOneAndUpdate(
    { id: playerId },
    { isConnect: isConnected, lastConnection: new Date() },
    { new: true }
  );
};

SPlayer.statics.clearExpiredPlayers = async function (
  days: number
): Promise<number> {
  const now = new Date();
  now.setDate(now.getDate() - days);

  try {
    const expiredPlayers = await this.find({
      lastConnection: { $lte: now },
    });

    const expiredIds = expiredPlayers.map((p: { id: string }) => p.id);

    if (expiredIds.length === 0) {
      console.log(
        `0 expired players removed (before ${now.toISOString().split('T')[0]}).`
      );
      return 0;
    }

    const result = await this.deleteMany({ id: { $in: expiredIds } });

    await this.updateMany({}, { $pull: { friends: { $in: expiredIds } } });

    await this.updateMany(
      {},
      { $pull: { friendRequests: { from: { $in: expiredIds } } } }
    );

    console.log(
      `${result.deletedCount} expired players removed (last connection before ${
        now.toISOString().split('T')[0]
      }).`
    );
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error clearing expired players:', error);
    return 0;
  }
};

SPlayer.statics.setPlayerLinkedStatus = async function (
  playerId: string,
  isLinked: boolean
): Promise<IPlayer> {
  return this.findOneAndUpdate(
    { id: playerId },
    { isLinked: isLinked },
    { new: true }
  );
};

SPlayer.statics.sendFriendRequest = async function (
  fromId: string,
  toFriendCode: string
): Promise<{ success: boolean; message: string }> {
  const recipient = await this.findOne({ friendCode: toFriendCode });
  if (!recipient) return { success: false, message: 'Target player not found' };

  if (recipient.id === fromId)
    return { success: false, message: 'Cannot friend yourself' };

  const alreadyFriend = recipient.friends.includes(fromId);
  const existingRequest = recipient.friendRequests.find(
    (req: { from: string }) => req.from === fromId
  );

  if (alreadyFriend) return { success: false, message: 'Already friends' };
  if (existingRequest)
    return { success: false, message: 'Request already pending' };

  recipient.friendRequests.push({ from: fromId, date: new Date() });
  await recipient.save();

  return { success: true, message: 'Friend request sent' };
};

SPlayer.statics.acceptedFriendRequest = async function (
  receiverId: string,
  senderId: string
): Promise<{ success: boolean; message: string }> {
  const receiver = await this.findOne({ id: receiverId });
  const sender = await this.findOne({ id: senderId });

  if (!receiver || !sender)
    return { success: false, message: 'Player(s) not found' };

  const requestIndex = receiver.friendRequests.findIndex(
    (req: { from: string }) => req.from === senderId
  );

  if (requestIndex === -1)
    return { success: false, message: 'No pending request from this player' };

  receiver.friendRequests.splice(requestIndex, 1);

  receiver.friends.push(senderId);
  sender.friends.push(receiverId);

  await Promise.all([receiver.save(), sender.save()]);
  return { success: true, message: 'Friend request accepted' };
};

SPlayer.statics.declineFriendRequest = async function (
  receiverId: string,
  senderId: string
): Promise<{ success: boolean; message: string }> {
  const receiver = await this.findOne({ id: receiverId });
  if (!receiver) return { success: false, message: 'Player not found' };

  const requestIndex = receiver.friendRequests.findIndex(
    (req: { from: string }) => req.from === senderId
  );

  if (requestIndex === -1)
    return { success: false, message: 'No pending request from this player' };

  receiver.friendRequests.splice(requestIndex, 1);
  await receiver.save();

  return { success: true, message: 'Friend request declined' };
};

SPlayer.statics.removeFriend = async function (
  playerId: string,
  friendId: string
): Promise<{ success: boolean; message: string }> {
  const player = await this.findOne({ id: playerId });
  const friend = await this.findOne({ id: friendId });

  if (!player || !friend)
    return { success: false, message: 'Player(s) not found' };

  player.friends = player.friends.filter((id: string) => id !== friendId);
  friend.friends = friend.friends.filter((id: string) => id !== playerId);

  await Promise.all([player.save(), friend.save()]);
  return { success: true, message: 'Friend removed successfully' };
};

SPlayer.statics.clearOldFriendRequests = async function (
  days: number
): Promise<number> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);

  let totalRemoved = 0;

  try {
    const players = await this.find({
      'friendRequests.date': { $lte: threshold },
    });

    for (const player of players) {
      const originalLength = player.friendRequests.length;
      player.friendRequests = player.friendRequests.filter(
        (req: { date: Date }) => req.date > threshold
      );
      const removedCount = originalLength - player.friendRequests.length;
      totalRemoved += removedCount;

      if (removedCount > 0) {
        await player.save();
      }
    }

    console.log(
      `${totalRemoved} expired friend requests removed (before ${
        threshold.toISOString().split('T')[0]
      }).`
    );
    return totalRemoved;
  } catch (err) {
    console.error('Error clearing old friend requests:', err);
    return 0;
  }
};

SPlayer.statics.getPendingFriendRequest = async function (
  playerId: string
): Promise<{ id: string; name: string; friendCode: string }[]> {
  const player = await this.findOne({ id: playerId });

  if (!player) return [];

  const fromIds = player.friendRequests.map(
    (req: { from: string }) => req.from
  );

  const pending = await this.find({
    id: { $in: fromIds },
  }).select('id name friendCode');

  return pending.map((p: { id: string; name: string; friendCode: string }) => ({
    id: p.id,
    name: p.name,
    friendCode: p.friendCode,
  }));
};

SPlayer.statics.getFriendList = async function (
  playerId: string
): Promise<{ id: string; name: string; friendCode: string }[]> {
  const player = await this.findOne({ id: playerId });

  const friends = await this.find({
    id: { $in: player.friends },
  }).select('id name friendCode');

  return friends.map((p: { id: string; name: string; friendCode: string }) => ({
    id: p.id,
    name: p.name,
    friendCode: p.friendCode,
  }));
};

SPlayer.statics.removePlayer = async function (
  playerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const player = await this.findOne({ id: playerId });
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    // Remove player from other players' friends lists
    await this.updateMany(
      { friends: playerId },
      { $pull: { friends: playerId } }
    );

    // Remove player from other players' friendRequests
    await this.updateMany(
      { 'friendRequests.from': playerId },
      { $pull: { friendRequests: { from: playerId } } }
    );

    // Finally, delete the player document
    await this.deleteOne({ id: playerId });

    return {
      success: true,
      message: 'Player and references removed successfully',
    };
  } catch (error) {
    console.error('Error removing player:', error);
    return { success: false, message: 'Error occurred while removing player' };
  }
};

SPlayer.statics.updateFields = async function (
  playerId: string,
  fields: Partial<IPlayer>
): Promise<IPlayer> {
  return this.findOneAndUpdate({ id: playerId }, fields, { new: true });
};

/**
 * Represents the Player model.
 *
 * @constant
 * @type {Model<IPlayer, IPlayerModel>}
 * @param {string} name - The name of the model.
 * @param {Schema} schema - The schema definition for the model.
 */
const Player = model<IPlayer, IPlayerModel>('Player', SPlayer);

export { Player, IPlayer };
