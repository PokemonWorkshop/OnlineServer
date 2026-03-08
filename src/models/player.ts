import { Schema, model, Document, Types } from 'mongoose';

// ─── Interfaces ───────────────────────────────────────────────────────────────

/**
 * Plain player data — use this type for `.lean()` results and service return values.
 *
 * @remarks
 * Do **not** use {@link IPlayer} outside the Mongoose layer; prefer this interface
 * in service methods, route handlers, and unit tests.
 */
export interface PlayerData {
  _id:             Types.ObjectId;
  /** Immutable game-side identifier (set by the PSDK client). */
  playerId:        string;
  /** Display name chosen by the trainer — may change on each login. */
  trainerName:     string;
  /** Human-readable unique code used for friend requests (format `XXXX-XXXX-XXXX`). */
  friendCode:      string;
  /** List of friend codes of accepted friends. */
  friends:         string[];
  /** Incoming friend codes waiting for acceptance. */
  pendingRequests: string[];
  /** UTC timestamp of the last successful heartbeat or login. */
  lastSeen:        Date;
  createdAt:       Date;
  updatedAt:       Date;
}

/**
 * Mongoose document interface — only for schema-level typing.
 * @internal
 */
export interface IPlayer extends PlayerData, Document {
  _id: Types.ObjectId;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const PlayerSchema = new Schema<IPlayer>(
  {
    playerId:        { type: String, required: true, unique: true, index: true },
    trainerName:     { type: String, required: true, trim: true, maxlength: 16 },
    friendCode:      { type: String, required: true, unique: true, index: true },
    friends:         { type: [String], default: [] },
    pendingRequests: { type: [String], default: [] },
    lastSeen:        { type: Date,   default: Date.now },
  },
  { timestamps: true },
);

// ─── Model ────────────────────────────────────────────────────────────────────

export const Player = model<IPlayer>('Player', PlayerSchema);
