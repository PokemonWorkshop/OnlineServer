import { Router, sendJson, readBody } from '../router';
import { Player } from '../../models/Player';
import { FriendService } from '../../services/FriendService';
import { z } from 'zod';

const RegisterSchema = z.object({
  playerId: z.string().min(1).max(64).trim(),
  trainerName: z.string().min(1).max(16).trim(),
});

export function registerAuthRoutes(router: Router): void {
  /**
   * POST /api/v1/auth/register
   * - First login       → creates the player and returns their friendCode
   * - Re-login          → returns existing info
   * - Re-login + name change → updates trainerName in the database
   *
   * The unique identifier is ALWAYS playerId.
   * The trainerName is cosmetic and may change on each login.
   *
   * Body: { playerId: string, trainerName: string }
   */
  router.post('/api/v1/auth/register', async (req, res) => {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid request body' });
      return;
    }

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      sendJson(res, 400, {
        error: 'Invalid data',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { playerId, trainerName } = parsed.data;

    const existing = await Player.findOne({ playerId });

    if (existing) {
      const nameChanged = existing.trainerName !== trainerName;

      if (nameChanged) {
        existing.trainerName = trainerName;
        existing.lastSeen = new Date();
        await existing.save();
      } else {
        // Update lastSeen without triggering a full save
        await Player.findByIdAndUpdate(existing._id, { lastSeen: new Date() });
      }

      sendJson(res, 200, {
        friendCode: existing.friendCode,
        trainerName, // return the effective name (potentially updated)
        alreadyRegistered: true,
        nameUpdated: nameChanged, // useful info for the client
      });
      return;
    }

    // First registration
    const friendCode = FriendService.generateFriendCode();
    const player = await Player.create({ playerId, trainerName, friendCode });

    sendJson(res, 201, {
      friendCode: player.friendCode,
      trainerName: player.trainerName,
      alreadyRegistered: false,
      nameUpdated: false,
    });
  });
}
