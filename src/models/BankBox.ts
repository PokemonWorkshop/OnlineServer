import { Schema, model, Document, Types } from 'mongoose';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * A single occupied slot inside a bank box.
 */
export interface IBankSlot {
  /** Zero-based position within the box (0 → `ENV.POKEBANK_BOX_SIZE - 1`). */
  slotIndex: number;
  /** Serialised creature data (PSDK format, opaque to the server). */
  creature:  Record<string, unknown>;
}

/**
 * Plain bank box data.
 *
 * @remarks
 * One document per (player, boxIndex) pair. Slots are stored as a sparse array
 * inside the document — absent entries mean an empty slot.
 */
export interface BankBoxData {
  _id:      Types.ObjectId;
  /** Owner's player ID. */
  playerId: string;
  /** Zero-based box index (0 → `ENV.POKEBANK_MAX_BOXES - 1`). */
  boxIndex: number;
  /** Occupied slots in this box. */
  slots:    IBankSlot[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose document interface — only for schema-level typing.
 * @internal
 */
export interface IBankBox extends BankBoxData, Document {
  _id: Types.ObjectId;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const BankBoxSchema = new Schema<IBankBox>(
  {
    playerId: { type: String, required: true },
    boxIndex: { type: Number, required: true, min: 0 },
    slots: [
      {
        slotIndex: { type: Number, required: true },
        creature:  { type: Schema.Types.Mixed, required: true },
        _id:       false, // subdocuments don't need their own _id
      },
    ],
  },
  { timestamps: true },
);

// Enforce uniqueness: one document per (player, box) pair
BankBoxSchema.index({ playerId: 1, boxIndex: 1 }, { unique: true });

// ─── Model ────────────────────────────────────────────────────────────────────

export const BankBox = model<IBankBox>('BankBox', BankBoxSchema);
