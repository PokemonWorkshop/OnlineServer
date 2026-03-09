import { Schema, model, Document, Types } from 'mongoose';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Plain pending result data.
 *
 * @remarks
 * Created when a trader executes a GTS trade while the original depositor is
 * offline. The depositor retrieves their received creature on next login via
 * `GET /api/v1/gts/pending` and claims it with `POST /api/v1/gts/pending/claim`.
 *
 * A player can accumulate multiple pending results if multiple trades resolved
 * while they were offline.
 */
export interface GtsPendingResultData {
  _id: Types.ObjectId;
  /** Player ID of the original depositor (the one who receives the creature). */
  recipientId: string;
  /** The creature sent by the trader — what the depositor gets. */
  receivedCreature: Record<string, unknown>;
  /** Display name of the trader, stored for UX purposes. */
  traderName: string;
  /** Auto-expiry date — pending results are deleted after GTS_EXPIRY_DAYS days. */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose document interface — only for schema-level typing.
 * @internal
 */
export interface IGtsPendingResult extends GtsPendingResultData, Document {
  _id: Types.ObjectId;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const GtsPendingResultSchema = new Schema<IGtsPendingResult>(
  {
    recipientId:      { type: String, required: true, index: true },
    receivedCreature: { type: Schema.Types.Mixed, required: true },
    traderName:       { type: String, required: true },
    expiresAt:        { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL index — MongoDB deletes unclaimed results automatically after expiresAt
GtsPendingResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const GtsPendingResult = model<IGtsPendingResult>(
  'GtsPendingResult',
  GtsPendingResultSchema,
);
