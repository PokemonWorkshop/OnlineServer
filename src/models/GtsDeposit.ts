import { Schema, model, Document, Types } from 'mongoose';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Plain GTS deposit data.
 *
 * @remarks
 * Use this type for `.lean()` results and service return values.
 * Do **not** use {@link IGtsDeposit} outside the Mongoose layer.
 */
export interface GtsDepositData {
  _id: Types.ObjectId;
  /** Player ID of the trainer who deposited the creature. */
  depositorId: string;
  /** Display name of the depositing trainer (denormalised for list views). */
  depositorName: string;
  /** Serialised creature data (PSDK format, opaque to the server). */
  creature: Record<string, unknown>;
  /** Species ID the depositor is requesting in return. */
  wantedSpeciesId: string;
  /** Minimum level accepted for the requested species. */
  wantedMinLevel: number;
  /** Maximum level accepted for the requested species. */
  wantedMaxLevel: number;
  /** Gender constraint on the requested species. */
  wantedGender: number;
  /** MongoDB TTL field — the document is automatically deleted after this date. */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose document interface — only for schema-level typing.
 * @internal
 */
export interface IGtsDeposit extends GtsDepositData, Document {
  _id: Types.ObjectId;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const GtsDepositSchema = new Schema<IGtsDeposit>(
  {
    depositorId: { type: String, required: true, index: true },
    depositorName: { type: String, required: true },
    creature: { type: Schema.Types.Mixed, required: true },
    wantedSpeciesId: { type: String, required: true },
    wantedMinLevel: { type: Number, default: 1, min: 1, max: 100 },
    wantedMaxLevel: { type: Number, default: 100, min: 1, max: 100 },
    wantedGender: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Compound index for GTS search queries (species + level range)
GtsDepositSchema.index({
  wantedSpeciesId: 1,
  wantedMinLevel: 1,
  wantedMaxLevel: 1,
});

// TTL index — MongoDB deletes expired deposits automatically
GtsDepositSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const GtsDeposit = model<IGtsDeposit>('GtsDeposit', GtsDepositSchema);
