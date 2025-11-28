import { model, Model } from 'mongoose';
import { IFriendRequest } from './friend-request.model';
import { SPlayer } from './player.schema';

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
 * @property {IFriendRequest[]} friendRequests - A list of friend requests received by the player.
 * @property {Date} lastConnection - The timestamp of the player's last connection.
 * @property {boolean} isConnect - Indicates if the player is currently connected.
 * @property {boolean} isLinked - Indicates if the player is linked to another account or service.
 */
export interface IPlayer extends Document {
  id: string;
  name: string;
  isGirl?: boolean;
  charsetBase: string;
  greeting: string;
  friendCode: string;
  friends: string[];
  friendRequests: IFriendRequest[];
  lastConnection: Date;
  isConnect: boolean;
  isLinked: boolean;
}

/**
 * Interface representing the player model.
 * Extends the base Model interface with additional player-specific methods.
 */
export interface IPlayerModel extends Model<IPlayer> {
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
 * Represents the Player model.
 */
export const Player: IPlayerModel = model<IPlayer, IPlayerModel>(
  'Player',
  SPlayer
);

