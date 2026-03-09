import { Player, PlayerData, playerExpiresAt } from '../models/Player';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Duration in milliseconds after which a player is considered offline.
 * A player whose `lastSeen` is older than this value will have `isOnline: false`
 * in friend list responses.
 */
const ONLINE_THRESHOLD_MS = 60_000; // 60 seconds

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Handles all friend-related operations: list retrieval, heartbeat,
 * friend requests, acceptance, declination, and removal.
 *
 * @remarks
 * All lookups use `friendCode` as the social identifier so that players can
 * share it without revealing their internal `playerId`.
 */
export class FriendService {
  /**
   * Generates a unique human-readable friend code.
   *
   * @remarks
   * Format: `XXXXXXXX` (8 numeric digits).
   * Uniqueness is not guaranteed at generation time — the database
   * `unique` index on `friendCode` provides the final guarantee.
   *
   * @returns A new friend code string.
   */
  static generateFriendCode(): string {
    const num = Math.floor(10000000 + Math.random() * 90000000);
    return num.toString();
  }

  /**
   * Returns the player's enriched friend list and pending requests.
   *
   * @remarks
   * Each friend entry is augmented with an `isOnline` boolean computed from
   * `lastSeen` compared against {@link ONLINE_THRESHOLD_MS}.
   *
   * @param playerId - The requesting player's ID.
   * @returns An object with `friends` and `pendingRequests`, or `null` if the
   *   player does not exist in the database.
   */
  async getList(playerId: string) {
    const player = await Player.findOne({ playerId }).lean<PlayerData>();
    if (!player) return null;

    const now = Date.now();

    const friends = await Player.find(
      { friendCode: { $in: player.friends } },
      { playerId: 1, trainerName: 1, friendCode: 1, lastSeen: 1 },
    ).lean<PlayerData[]>();

    const enrichedFriends = friends.map((f) => ({
      playerId: f.playerId,
      trainerName: f.trainerName,
      friendCode: f.friendCode,
      isOnline: now - new Date(f.lastSeen).getTime() < ONLINE_THRESHOLD_MS,
      lastSeen: f.lastSeen,
    }));

    const pending = await Player.find(
      { friendCode: { $in: player.pendingRequests } },
      { trainerName: 1, friendCode: 1 },
    ).lean<PlayerData[]>();

    return { friends: enrichedFriends, pendingRequests: pending };
  }

  /**
   * Updates `lastSeen` for the given player (polling heartbeat).
   *
   * @remarks
   * PSDK clients should call `POST /api/v1/friends/heartbeat` approximately
   * every 30 seconds. A player is considered online for 60 seconds after the
   * last heartbeat.
   *
   * @param playerId - The player to update.
   */
  async heartbeat(playerId: string): Promise<void> {
    await Player.findOneAndUpdate({ playerId }, { lastSeen: new Date(), expiresAt: playerExpiresAt() });
  }

  /**
   * Sends a friend request from `fromPlayerId` to the player identified by
   * `toFriendCode`.
   *
   * @param fromPlayerId - Initiating player's ID.
   * @param toFriendCode - Target player's friend code.
   * @returns `{ ok: true }` on success, or `{ ok: false, error }` on failure.
   */
  async sendRequest(fromPlayerId: string, toFriendCode: string) {
    const from = await Player.findOne({ playerId: fromPlayerId });
    const to = await Player.findOne({ friendCode: toFriendCode });

    if (!from || !to) return { ok: false, error: 'Player not found' };
    if (from.playerId === to.playerId)
      return { ok: false, error: 'Cannot add yourself' };
    if (from.friends.includes(to.friendCode))
      return { ok: false, error: 'This player is already your friend' };
    if (to.pendingRequests.includes(from.friendCode))
      return { ok: false, error: 'A request is already pending' };

    await Player.findByIdAndUpdate(to._id, {
      $addToSet: { pendingRequests: from.friendCode },
    });

    return { ok: true };
  }

  /**
   * Accepts a pending friend request, creating a mutual friendship.
   *
   * @remarks
   * Both players' `friends` arrays are updated atomically (two separate
   * `$addToSet` operations). The request is removed from `pendingRequests`.
   *
   * @param playerId            - The player accepting the request.
   * @param requesterFriendCode - Friend code of the player who sent the request.
   * @returns `{ ok: true }` on success, or `{ ok: false, error }` on failure.
   */
  async acceptRequest(playerId: string, requesterFriendCode: string) {
    const player = await Player.findOne({ playerId });
    const requester = await Player.findOne({ friendCode: requesterFriendCode });

    if (!player || !requester) return { ok: false, error: 'Player not found' };
    if (!player.pendingRequests.includes(requesterFriendCode))
      return { ok: false, error: 'No request from this friend' };

    await Player.findByIdAndUpdate(player._id, {
      $pull: { pendingRequests: requesterFriendCode },
      $addToSet: { friends: requesterFriendCode },
    });
    await Player.findByIdAndUpdate(requester._id, {
      $addToSet: { friends: player.friendCode },
    });

    return { ok: true };
  }

  /**
   * Declines a pending friend request.
   *
   * @remarks
   * Always succeeds — if the request does not exist the operation is a no-op.
   *
   * @param playerId            - The player declining the request.
   * @param requesterFriendCode - Friend code of the sender.
   */
  async declineRequest(playerId: string, requesterFriendCode: string) {
    await Player.findOneAndUpdate(
      { playerId },
      { $pull: { pendingRequests: requesterFriendCode } },
    );
    return { ok: true };
  }

  /**
   * Removes a friendship from **both** players' lists.
   *
   * @param playerId   - The player initiating the removal.
   * @param friendCode - Friend code of the player to remove.
   * @returns `{ ok: true }` on success, or `{ ok: false, error }` on failure.
   */
  async removeFriend(playerId: string, friendCode: string) {
    const player = await Player.findOne({ playerId });
    const friend = await Player.findOne({ friendCode });

    if (!player || !friend) return { ok: false, error: 'Player not found' };

    await Player.findByIdAndUpdate(player._id, {
      $pull: { friends: friendCode },
    });
    await Player.findByIdAndUpdate(friend._id, {
      $pull: { friends: player.friendCode },
    });

    return { ok: true };
  }
}

export const friendService = new FriendService();
