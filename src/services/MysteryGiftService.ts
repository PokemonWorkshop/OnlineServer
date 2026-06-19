import {
  MysteryGift,
  MysteryGiftData,
  MysteryGiftDistrib,
  IGiftItem,
  IGiftCreature,
  IGiftEgg,
} from '../models/MysteryGift';
import { ErrorCode } from '../http/ErrorCode';

// ─── Params ───────────────────────────────────────────────────────────────────

export interface CreateGiftParams {
  title: string;
  csvDetails?: { id: number; line: number };
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

// Params for a partial admin edit of an existing gift.
// Every field is optional since updates may touch just one or two fields.
export interface UpdateGiftParams {
  title?: string;
  csvDetails?: { id: number; line: number };
  type?: MysteryGiftDistrib;

  items?: IGiftItem[];
  creatures?: IGiftCreature[];
  eggs?: IGiftEgg[];

  code?: string;
  allowedClaimers?: string[];
  maxClaims?: number;

  alwaysAvailable?: boolean;
  validFrom?: Date;
  validTo?: Date;
  rarity?: number;

  // Maps to isActive on the model — lets an admin reactivate or deactivate directly.
  active?: boolean;
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
    code?: ErrorCode;
    error?: string;
    gift?: Pick<
      MysteryGiftData,
      'giftId' | 'title' | 'items' | 'creatures' | 'eggs' | 'csvDetails'
    >;
  }> {
    if (!code && !giftId)
      return {
        ok: false,
        code: ErrorCode.MISSING_REQUIRED_FIELD,
        error: 'Provide either a code or a giftId.',
      };

    // Lookup: if code, search in type 'code'; otherwise by giftId
    const query = code
      ? { code: code.toUpperCase(), type: 'code', isActive: true }
      : { giftId, type: 'internet', isActive: true };

    const gift = await MysteryGift.findOne(query);
    if (!gift) {
      const errorCode = code
        ? ErrorCode.GIFT_INVALID_CODE
        : ErrorCode.GIFT_NOT_FOUND;
      return { ok: false, code: errorCode, error: 'Gift not found.' };
    }

    const { canClaim, reason, errorCode } = gift.canBeClaimed(playerId);
    if (!canClaim)
      return {
        ok: false,
        code: errorCode ?? ErrorCode.GIFT_NOT_AVAILABLE,
        error: reason,
      };

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
        csvDetails: gift.csvDetails ?? undefined,
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
      if (existing)
        throw new Error(`A gift with code "${normalizedCode}" already exists.`);
    }

    const gift = await MysteryGift.create({
      ...params,
      code: params.code?.toUpperCase(),
    });
    return gift.toObject() as unknown as MysteryGiftData;
  }

  /**
   * Lists ALL gifts regardless of state (active/inactive, expired or not).
   * Full admin view — includes claimedBy and allowedClaimers, unlike listForPlayer.
   */
  async listAll(): Promise<MysteryGiftData[]> {
    return MysteryGift.find({}).select('-__v').lean<MysteryGiftData[]>();
  }

  /**
   * Returns the full detail of a single gift by giftId (admin view).
   * Returns null if not found, left to the route to translate into a 404.
   */
  async getById(giftId: string): Promise<MysteryGiftData | null> {
    return MysteryGift.findOne({ giftId })
      .select('-__v')
      .lean<MysteryGiftData>();
  }

  /**
   * Updates an existing gift (admin endpoint), partially.
   * Re-validates type/code consistency against the merged (existing + update) state,
   * and checks for code collisions only when the code actually changes.
   */
  async update(
    giftId: string,
    params: UpdateGiftParams,
  ): Promise<MysteryGiftData | null> {
    const existing = await MysteryGift.findOne({ giftId });
    if (!existing) return null;

    const nextType = params.type ?? existing.type;
    const nextCode =
      params.code !== undefined ? params.code.toUpperCase() : existing.code;

    if (nextType === 'code' && !nextCode)
      throw new Error('A code is required for a gift of type "code".');

    // Only check for collisions if the code is actually changing
    if (params.code !== undefined && nextCode !== existing.code) {
      const duplicate = await MysteryGift.exists({
        code: nextCode,
        giftId: { $ne: giftId },
      });
      if (duplicate)
        throw new Error(`A gift with code "${nextCode}" already exists.`);
    }

    // "active" maps to the isActive model field; everything else passes through as-is
    const { active, code, ...rest } = params;
    const updateDoc: Record<string, unknown> = {
      ...rest,
      ...(code !== undefined ? { code: nextCode } : {}),
      ...(active !== undefined ? { isActive: active } : {}),
    };

    return MysteryGift.findOneAndUpdate(
      { giftId },
      { $set: updateDoc },
      { new: true },
    )
      .select('-__v')
      .lean<MysteryGiftData>();
  }

  /** Deactivates a gift (soft delete) without removing it from DB. */
  async deactivate(
    giftId: string,
  ): Promise<{ ok: boolean; code?: ErrorCode; error?: string }> {
    const result = await MysteryGift.findOneAndUpdate(
      { giftId },
      { isActive: false },
    );
    if (!result)
      return {
        ok: false,
        code: ErrorCode.GIFT_NOT_FOUND,
        error: 'Gift not found.',
      };
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
