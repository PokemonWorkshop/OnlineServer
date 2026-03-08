import { BankBox, BankBoxData } from '../models/BankBox';
import { ENV } from '../config/env';

/**
 * Handles PokéBank operations: box retrieval, creature deposit, and withdrawal.
 *
 * @remarks
 * The server treats creature data as an opaque `Record<string, unknown>` — it
 * does not validate or transform PSDK creature fields. Validation is the
 * responsibility of the PSDK client before calling the API.
 *
 * Box and slot counts are capped by `ENV.POKEBANK_MAX_BOXES` and
 * `ENV.POKEBANK_BOX_SIZE` respectively.
 */
export class BankService {

  /**
   * Returns all boxes (and their slots) belonging to a player.
   *
   * @param playerId - The player's ID.
   * @returns An array of {@link BankBoxData}. Empty array if the player has no boxes yet.
   */
  async getBoxes(playerId: string): Promise<BankBoxData[]> {
    return BankBox.find({ playerId }).lean<BankBoxData[]>();
  }

  /**
   * Deposits a creature into a specific slot within a box.
   *
   * @remarks
   * If the box document does not yet exist it is created automatically.
   * The operation fails if the target slot is already occupied.
   *
   * @param playerId  - The depositing player's ID.
   * @param boxIndex  - Target box (0 → `ENV.POKEBANK_MAX_BOXES - 1`).
   * @param slotIndex - Target slot within the box (0 → `ENV.POKEBANK_BOX_SIZE - 1`).
   * @param creature  - Serialised creature data to store.
   * @returns `{ ok: true }` on success, or `{ ok: false, error }` on failure.
   */
  async depositCreature(
    playerId:  string,
    boxIndex:  number,
    slotIndex: number,
    creature:  Record<string, unknown>,
  ): Promise<{ ok: boolean; error?: string }> {
    if (boxIndex < 0 || boxIndex >= ENV.POKEBANK_MAX_BOXES)
      return { ok: false, error: `Invalid box index (0 to ${ENV.POKEBANK_MAX_BOXES - 1})` };

    if (slotIndex < 0 || slotIndex >= ENV.POKEBANK_BOX_SIZE)
      return { ok: false, error: `Invalid slot index (0 to ${ENV.POKEBANK_BOX_SIZE - 1})` };

    const box = await BankBox.findOne({ playerId, boxIndex }).lean<BankBoxData>();

    if (box) {
      if (box.slots.some((s) => s.slotIndex === slotIndex))
        return { ok: false, error: 'This slot is already occupied' };

      await BankBox.findByIdAndUpdate(box._id, {
        $push: { slots: { slotIndex, creature } },
      });
    } else {
      await BankBox.create({ playerId, boxIndex, slots: [{ slotIndex, creature }] });
    }

    return { ok: true };
  }

  /**
   * Withdraws a creature from a specific slot and returns it.
   *
   * @remarks
   * The slot is emptied atomically via `$pull`. If the box or slot does not
   * exist the operation fails without modifying any data.
   *
   * @param playerId  - The withdrawing player's ID.
   * @param boxIndex  - Source box index.
   * @param slotIndex - Source slot index.
   * @returns `{ ok: true, creature }` on success, or `{ ok: false, error }` on failure.
   */
  async withdrawCreature(
    playerId:  string,
    boxIndex:  number,
    slotIndex: number,
  ): Promise<{ ok: boolean; creature?: Record<string, unknown>; error?: string }> {
    const box = await BankBox.findOne({ playerId, boxIndex });
    if (!box) return { ok: false, error: 'Box is empty or does not exist' };

    const slot = box.slots.find((s) => s.slotIndex === slotIndex);
    if (!slot) return { ok: false, error: 'This slot is empty' };

    await BankBox.findByIdAndUpdate(box._id, { $pull: { slots: { slotIndex } } });

    return { ok: true, creature: slot.creature };
  }
}

export const bankService = new BankService();
