import { Router, sendJson, readBody } from '../router';
import { extractPlayer } from '../middleware';
import { Player, playerExpiresAt } from '../../models/Player';
import { FriendService } from '../../services/FriendService';
import { playerService } from '../../services/PlayerService';
import { z } from 'zod';

const RegisterSchema = z.object({
  playerId:    z.string().min(1).max(64).trim(),
  trainerName: z.string().min(1).max(16).trim(),
  isFemale:    z.boolean().optional(),
  spriteId:    z.string().trim().optional(),
});

const UpdateProfileSchema = z.object({
  trainerName:    z.string().min(1).max(16).trim().optional(),
  isFemale:       z.boolean().optional(),
  spriteId:       z.string().trim().optional(),
  profileMessage: z.string().max(256).trim().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const DeleteProfileSchema = z.object({
  confirm: z.literal(true),
});

export function registerAuthRoutes(router: Router): void {
  /**
   * POST /api/v1/auth/register
   * - First login  → creates the player and returns their friendCode
   * - Re-login     → updates lastSeen + expiresAt, optionally updates trainerName / isFemale / spriteId
   *
   * Body: { playerId, trainerName, isFemale?, spriteId? }
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
      sendJson(res, 400, { error: 'Invalid data', details: parsed.error.flatten() });
      return;
    }

    const { playerId, trainerName, isFemale, spriteId } = parsed.data;
    const existing = await Player.findOne({ playerId });

    if (existing) {
      const nameChanged = existing.trainerName !== trainerName;
      const updates: Record<string, unknown> = {
        lastSeen:  new Date(),
        expiresAt: playerExpiresAt(),
      };

      if (nameChanged)            updates.trainerName = trainerName;
      if (isFemale !== undefined) updates.isFemale    = isFemale;
      if (spriteId !== undefined) updates.spriteId    = spriteId;

      await Player.findByIdAndUpdate(existing._id, updates);

      sendJson(res, 200, {
        friendCode:        existing.friendCode,
        trainerName,
        alreadyRegistered: true,
        nameUpdated:       nameChanged,
      });
      return;
    }

    // First registration
    const friendCode = FriendService.generateFriendCode();
    const player = await Player.create({
      playerId,
      trainerName,
      friendCode,
      ...(isFemale !== undefined && { isFemale }),
      ...(spriteId !== undefined && { spriteId }),
    });

    sendJson(res, 201, {
      friendCode:        player.friendCode,
      trainerName:       player.trainerName,
      alreadyRegistered: false,
      nameUpdated:       false,
    });
  });

  /**
   * PATCH /api/v1/auth/profile
   * Update one or more profile fields. All fields optional — at least one required.
   * Also refreshes lastSeen and expiresAt.
   *
   * Requires: x-player-id header
   * Body: { trainerName?, isFemale?, spriteId?, profileMessage? }
   */
  router.patch('/api/v1/auth/profile', async (req, res) => {
    if (!extractPlayer(req, res)) return;

    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid request body' });
      return;
    }

    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      sendJson(res, 400, { error: 'Invalid data', details: parsed.error.flatten() });
      return;
    }

    const player = await Player.findOneAndUpdate(
      { playerId: req.playerId },
      { ...parsed.data, lastSeen: new Date(), expiresAt: playerExpiresAt() },
      { new: true },
    );

    if (!player) {
      sendJson(res, 404, { error: 'Player not found' });
      return;
    }

    sendJson(res, 200, {
      trainerName:    player.trainerName,
      isFemale:       player.isFemale,
      spriteId:       player.spriteId,
      profileMessage: player.profileMessage,
    });
  });

  /**
   * DELETE /api/v1/auth/profile
   * Permanently deletes the authenticated player's account and cascades:
   * - removes the player from other players' friend lists and pending requests
   * - deletes the player's active GTS deposit
   * - deletes any GtsPendingResult documents addressed to the player
   *
   * Requires: x-player-id header
   * Body: { confirm: true }
   */
  router.delete('/api/v1/auth/profile', async (req, res) => {
    if (!extractPlayer(req, res)) return;

    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid request body' });
      return;
    }

    const parsed = DeleteProfileSchema.safeParse(body);
    if (!parsed.success) {
      sendJson(res, 400, { error: 'Missing confirmation', details: parsed.error.flatten() });
      return;
    }

    const result = await playerService.deletePlayer(req.playerId!);

    if (!result.ok) {
      sendJson(res, 404, { error: result.error });
      return;
    }

    sendJson(res, 200, { ok: true });
  });
}
