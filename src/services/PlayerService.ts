import { Player } from '../models/Players';
import { GtsDeposit } from '../models/GtsDeposit';
import { GtsPendingResult } from '../models/GtsPendingResult';

/**
 * Handles player lifecycle operations — notably account deletion,
 * which requires cascading cleanup across multiple collections.
 */
export class PlayerService {
  /**
   * Deletes a player and performs all cascading cleanup:
   * - Removes the player from other players' `friends` lists
   * - Removes the player from other players' `pendingRequests` lists
   * - Deletes the player's active GTS deposit
   * - Deletes any GtsPendingResult documents belonging to the player
   *
   * @param playerId - The game-side ID of the player to delete.
   * @returns `{ ok: true }` on success, or `{ ok: false, error }` if player not found.
   */
  async deletePlayer(
    playerId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const player = await Player.findOne({ playerId }).lean();
    if (!player) return { ok: false, error: 'Player not found' };

    const { friendCode } = player;

    await Promise.all([
      // Remove from other players' friend lists
      Player.updateMany(
        { friends: friendCode },
        { $pull: { friends: friendCode } },
      ),
      // Remove from other players' pending requests
      Player.updateMany(
        { pendingRequests: friendCode },
        { $pull: { pendingRequests: friendCode } },
      ),
      // Delete the player's own GTS deposit
      GtsDeposit.deleteOne({ depositorId: playerId }),
      // Delete GtsPendingResult documents where this player is the recipient
      GtsPendingResult.deleteMany({ recipientId: playerId }),
    ]);

    await Player.deleteOne({ playerId });

    return { ok: true };
  }
}

export const playerService = new PlayerService();
