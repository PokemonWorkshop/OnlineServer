import { GtsDeposit, GtsDepositData } from '../models/GtsDeposit';
import { GtsPendingResult, GtsPendingResultData } from '../models/GtsPendingResult';
import { ENV } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Criteria for the species a depositor wants in return.
 */
interface WantedParams {
  /** Species ID requested in return (must not be blacklisted). */
  speciesId: string;
  /** Minimum acceptable level. Defaults to `1`. */
  minLevel?: number;
  /** Maximum acceptable level. Defaults to `100`. */
  maxLevel?: number;
  /** Gender constraint. Omit or set to `-1` to disable. */
  gender?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Handles GTS (Global Trade System) operations: deposit, search, trade,
 * withdrawal, and pending result management.
 *
 * @remarks
 * Species listed in `ENV.GTS_SPECIES_BLACKLIST` cannot be deposited **or** requested.
 * A player can only have **one** active deposit at a time.
 * Deposits expire after `ENV.GTS_EXPIRY_DAYS` days — MongoDB's TTL index handles deletion.
 *
 * When a trade executes, the original depositor may be offline. In that case,
 * a {@link GtsPendingResult} document is created so they can claim their received
 * creature the next time they connect. Pending results share the same TTL duration.
 */
export class GtsService {
  /**
   * Deposits a creature on the GTS.
   *
   * @remarks
   * Both the deposited species and the wanted species are checked against the blacklist.
   * A player with an existing deposit receives an error instead of a second entry.
   *
   * @param playerId - ID of the depositing player.
   * @param creature - Serialised creature data (PSDK format).
   * @param wanted   - Species and filter criteria the depositor wants in return.
   * @returns `{ ok: true, depositId }` on success, or `{ ok: false, error }` on failure.
   */
  async deposit(
    playerId: string,
    creature: Record<string, unknown>,
    wanted: WantedParams,
  ): Promise<{ ok: boolean; depositId?: string; error?: string }> {
    const speciesId = String((creature as any).speciesId ?? '');

    if (ENV.GTS_SPECIES_BLACKLIST.includes(speciesId))
      return { ok: false, error: 'This species cannot be deposited on the GTS' };

    if (ENV.GTS_SPECIES_BLACKLIST.includes(wanted.speciesId))
      return { ok: false, error: 'This species cannot be requested on the GTS' };

    const existing = await GtsDeposit.findOne({ depositorId: playerId });
    if (existing)
      return { ok: false, error: 'You already have a creature deposited on the GTS' };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ENV.GTS_EXPIRY_DAYS);

    const deposit = await GtsDeposit.create({
      depositorId:     playerId,
      depositorName:   String((creature as any).trainerName ?? playerId),
      creature,
      wantedSpeciesId: wanted.speciesId,
      wantedMinLevel:  wanted.minLevel ?? 1,
      wantedMaxLevel:  wanted.maxLevel ?? 100,
      wantedGender:    wanted.gender ?? -1,
      expiresAt,
    });

    return { ok: true, depositId: String(deposit._id) };
  }

  /**
   * Searches for GTS deposits compatible with the offered creature.
   *
   * @remarks
   * Filters by `wantedSpeciesId`, level range, and gender. The creature data
   * itself is **not** returned in list results (only metadata).
   *
   * @param offeredSpeciesId - Species ID the searching player wants to offer.
   * @param offeredLevel     - Level of the offered creature.
   * @param offeredGender    - Gender of the offered creature.
   * @param page             - Zero-based page index (default `0`).
   * @param limit            - Results per page (default `20`).
   * @returns An array of matching {@link GtsDepositData} objects (without `creature`).
   */
  async search(
    offeredSpeciesId: string,
    offeredLevel: number,
    offeredGender: number,
    page = 0,
    limit = 20,
  ): Promise<GtsDepositData[]> {
    return GtsDeposit.find({
      wantedSpeciesId: offeredSpeciesId,
      wantedMinLevel:  { $lte: offeredLevel },
      wantedMaxLevel:  { $gte: offeredLevel },
      $or:             [{ wantedGender: -1 }, { wantedGender: offeredGender }],
    })
      .skip(page * limit)
      .limit(limit)
      .select('-creature')
      .lean<GtsDepositData[]>();
  }

  /**
   * Executes a GTS trade: validates the offered creature, deletes the deposit,
   * stores the traded creature in a {@link GtsPendingResult} for the depositor,
   * and returns the deposited creature to the trader.
   *
   * @remarks
   * The offered creature must match the depositor's `wantedSpeciesId`, level
   * range, and gender constraint. A player cannot trade with their own deposit.
   *
   * Because the original depositor may be offline when the trade executes, the
   * creature they receive is **never lost**: it is stored in a `GtsPendingResult`
   * document that the depositor can claim via `POST /api/v1/gts/pending/claim`.
   * Pending results share the same TTL as deposits (`ENV.GTS_EXPIRY_DAYS` days).
   *
   * @param traderId        - ID of the player making the trade.
   * @param depositId       - MongoDB `_id` of the target deposit.
   * @param offeredCreature - Serialised creature the trader is giving away.
   * @returns `{ ok: true, receivedCreature }` on success, or `{ ok: false, error }`.
   */
  async trade(
    traderId: string,
    depositId: string,
    offeredCreature: Record<string, unknown>,
  ): Promise<{ ok: boolean; receivedCreature?: Record<string, unknown>; error?: string }> {
    const deposit = await GtsDeposit.findById(depositId);
    if (!deposit) return { ok: false, error: 'Deposit not found or expired' };
    if (deposit.depositorId === traderId)
      return { ok: false, error: 'Cannot trade with yourself' };

    const offeredSpecies = String((offeredCreature as any).speciesId ?? '');
    const offeredLevel   = Number((offeredCreature as any).level ?? 0);
    const offeredGender  = Number((offeredCreature as any).gender ?? -1);

    if (offeredSpecies !== deposit.wantedSpeciesId)
      return { ok: false, error: 'The offered species does not match the request' };

    if (offeredLevel < deposit.wantedMinLevel || offeredLevel > deposit.wantedMaxLevel)
      return { ok: false, error: 'The offered creature level is outside the requested range' };

    if (deposit.wantedGender !== -1 && offeredGender !== deposit.wantedGender)
      return { ok: false, error: 'The offered creature gender does not match the request' };

    const receivedCreature = deposit.creature;
    const depositorId      = deposit.depositorId;

    // Delete the deposit atomically
    await GtsDeposit.findByIdAndDelete(depositId);

    // Store the traded creature for the (possibly offline) depositor
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ENV.GTS_EXPIRY_DAYS);

    await GtsPendingResult.create({
      recipientId:      depositorId,
      receivedCreature: offeredCreature,
      traderName:       String((offeredCreature as any).trainerName ?? traderId),
      expiresAt,
    });

    return { ok: true, receivedCreature };
  }

  /**
   * Withdraws the player's own creature from the GTS and deletes the deposit.
   *
   * @param playerId - ID of the player withdrawing their creature.
   * @returns `{ ok: true, creature }` on success, or `{ ok: false, error }` if
   *   no active deposit was found.
   */
  async withdraw(
    playerId: string,
  ): Promise<{ ok: boolean; creature?: Record<string, unknown>; error?: string }> {
    const deposit = await GtsDeposit.findOneAndDelete({ depositorId: playerId });
    if (!deposit) return { ok: false, error: 'No active deposit found' };
    return { ok: true, creature: deposit.creature };
  }

  /**
   * Returns the player's current active deposit, or `null` if none exists.
   *
   * @param playerId - ID of the player.
   */
  async getMyDeposit(playerId: string): Promise<GtsDepositData | null> {
    return GtsDeposit.findOne({ depositorId: playerId }).lean<GtsDepositData>();
  }

  // ─── Pending results ────────────────────────────────────────────────────────

  /**
   * Returns all pending trade results waiting for the player to claim.
   *
   * @remarks
   * A pending result is created when another player successfully trades with
   * the player's deposit while the player is offline. Each entry contains the
   * received creature and the name of the trader.
   *
   * @param playerId - ID of the player.
   * @returns Array of pending results (may be empty).
   */
  async getPendingResults(playerId: string): Promise<GtsPendingResultData[]> {
    return GtsPendingResult.find({ recipientId: playerId }).lean<GtsPendingResultData[]>();
  }

  /**
   * Claims (removes and returns) a specific pending trade result.
   *
   * @remarks
   * The pending result document is deleted atomically. If it does not exist or
   * belongs to a different player, the call fails safely without touching any data.
   *
   * @param playerId        - ID of the claiming player (must match `recipientId`).
   * @param pendingResultId - MongoDB `_id` of the pending result.
   * @returns `{ ok: true, creature }` on success, or `{ ok: false, error }`.
   */
  async claimPendingResult(
    playerId: string,
    pendingResultId: string,
  ): Promise<{ ok: boolean; creature?: Record<string, unknown>; error?: string }> {
    const result = await GtsPendingResult.findOneAndDelete({
      _id:         pendingResultId,
      recipientId: playerId,
    });

    if (!result)
      return { ok: false, error: 'Pending result not found or does not belong to you' };

    return { ok: true, creature: result.receivedCreature };
  }
}

export const gtsService = new GtsService();
