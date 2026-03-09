import { Schema, model, Document, Types } from 'mongoose';
import { ENV } from '../config/env';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function playerExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ENV.DAYS_PLAYER_INACTIVE);
  return d;
}

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
  /** Whether the trainer is female (false = male, true = female). Defaults to false. */
  isFemale:        boolean;
  /** Sprite identifier used to render the trainer overworld character. */
  spriteId:        string;
  /** Message displayed on the player's public profile. */
  profileMessage:  string;
  /** Human-readable unique code used for friend requests (format `XXXXXXXX`). */
  friendCode:      string;
  /** List of friend codes of accepted friends. */
  friends:         string[];
  /** Incoming friend codes waiting for acceptance. */
  pendingRequests: string[];
  /** UTC timestamp of the last successful heartbeat or login. */
  lastSeen:        Date;
  /**
   * UTC date after which MongoDB will automatically delete this document.
   * Recomputed on every login, heartbeat, and profile update.
   * Controlled by the `DAYS_PLAYER_INACTIVE` environment variable.
   */
  expiresAt:       Date;
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
    playerId:        { type: String,  required: true, unique: true, index: true },
    trainerName:     { type: String,  required: true, trim: true, maxlength: 16 },
    isFemale:        { type: Boolean, default: false },
    spriteId:        { type: String,  default: '', trim: true },
    profileMessage:  { type: String,  default: '', trim: true, maxlength: 256 },
    friendCode:      { type: String,  required: true, unique: true, index: true },
    friends:         { type: [String], default: [] },
    pendingRequests: { type: [String], default: [] },
    lastSeen:        { type: Date,    default: Date.now },
    expiresAt:       { type: Date,    default: playerExpiresAt },
  },
  { timestamps: true },
);

// TTL index — MongoDB deletes the document when expiresAt is reached.
PlayerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const Player = model<IPlayer>('Player', PlayerSchema);
