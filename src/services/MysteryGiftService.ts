import {
  MysteryGift,
  MysteryGiftData,
  MysteryGiftDistrib,
  IGiftItem,
  IGiftCreature,
  IGiftEgg,
} from '../models/MysteryGift';

// ─── Params ───────────────────────────────────────────────────────────────────

export interface CreateGiftParams {
  title: string;
  type: MysteryGiftDistrib;

  // Content
  items?: IGiftItem[];
  creatures?: IGiftCreature[];
  eggs?: IGiftEgg[];

  // Distribution
  code?: string; // required if type === 'code'
  allowedClaimers?: string[];
  maxClaims?: number;

  // Validity
  alwaysAvailable?: boolean;
  validFrom?: Date;
  validTo?: Date;
  rarity?: number;
}

// Public return type (without claimedBy or allowedClaimers)
export type PublicGift = Omit<
  MysteryGiftData,
  'claimedBy' | 'allowedClaimers' | '_id'
>;

// ─── Service ──────────────────────────────────────────────────────────────────

export class MysteryGiftService {
  /**
   * Lists active gifts accessible to the player:
   *   - type 'internet': publicly visible (not yet claimed)
   *   - type 'code': not listed (player must know the code)
   * Never exposes claimedBy or allowedClaimers.
   */
  async listForPlayer(playerId: string): Promise<PublicGift[]> {
    const now = new Date();
    return MysteryGift.find({
      isActive: true,
      type: 'internet',
      // Not yet claimed by this player ($nin works correctly on arrays)
      claimedBy: { $nin: [playerId] },
      // Currently available (alwaysAvailable OR within valid date range)
      $or: [
        { alwaysAvailable: true },
        {
          alwaysAvailable: false,
          $and: [
            { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
            { $or: [{ validTo: null }, { validTo: { $gte: now } }] },
          ],
        },
      ],
      // Whitelist: either empty (open to all) or contains this player
      $and: [
        {
          $or: [
            { allowedClaimers: { $size: 0 } },
            { allowedClaimers: { $in: [playerId] } },
          ],
        },
      ],
    })
      .select('-claimedBy -allowedClaimers -__v')
      .lean<PublicGift[]>();
  }

  /**
   * Claims a gift:
   *   - via code → body.code
   *   - via id   → body.giftId (internet type only)
   */
  async claim(
    playerId: string,
    { code, giftId }: { code?: string; giftId?: string },
  ): Promise<{
    ok: boolean;
    error?: string;
    gift?: Pick<
      MysteryGiftData,
      'giftId' | 'title' | 'items' | 'creatures' | 'eggs'
    >;
  }> {
    if (!code && !giftId)
      return { ok: false, error: 'Provide either a code or a giftId.' };

    // Lookup: if code, search in type 'code'; otherwise by giftId
    const query = code
      ? { code: code.toUpperCase(), type: 'code', isActive: true }
      : { giftId, type: 'internet', isActive: true };

    const gift = await MysteryGift.findOne(query);
    if (!gift) return { ok: false, error: 'Gift not found.' };

    const { canClaim, reason } = gift.canBeClaimed(playerId);
    if (!canClaim) return { ok: false, error: reason };

    // Atomic push — avoids race conditions if two players claim simultaneously
    await MysteryGift.findByIdAndUpdate(gift._id, {
      $addToSet: { claimedBy: playerId },
    });

    return {
      ok: true,
      gift: {
        giftId: gift.giftId,
        title: gift.title,
        items: gift.items ?? [],
        creatures: gift.creatures ?? [],
        eggs: gift.eggs ?? [],
      },
    };
  }

  /**
   * Creates a new mystery gift (admin endpoint).
   * Validates type/code consistency in addition to schema-level validation.
   */
  async create(params: CreateGiftParams): Promise<MysteryGiftData> {
    if (params.type === 'code' && !params.code)
      throw new Error('A code is required for a gift of type "code".');

    // Reject duplicate codes upfront with a clear error (before hitting the DB unique index)
    if (params.type === 'code' && params.code) {
      const normalizedCode = params.code.toUpperCase();
      const existing = await MysteryGift.exists({ code: normalizedCode });
      if (existing) throw new Error(`A gift with code "${normalizedCode}" already exists.`);
    }

    const gift = await MysteryGift.create({
      ...params,
      code: params.code?.toUpperCase(),
    });
    return gift.toObject() as unknown as MysteryGiftData;
  }

  /** Deactivates a gift (soft delete) without removing it from DB. */
  async deactivate(giftId: string): Promise<{ ok: boolean; error?: string }> {
    const result = await MysteryGift.findOneAndUpdate(
      { giftId },
      { isActive: false },
    );
    if (!result) return { ok: false, error: 'Gift not found.' };
    return { ok: true };
  }

  /** Permanently deletes expired gifts (cron or admin call). */
  async purgeExpired(): Promise<number> {
    const now = new Date();
    const result = await MysteryGift.deleteMany({
      alwaysAvailable: false,
      validTo: { $lt: now },
    });
    return result.deletedCount ?? 0;
  }
}

export const mysteryGiftService = new MysteryGiftService();
