import { Schema, model, Document, Types } from 'mongoose';

// ─── Sub-interfaces ───────────────────────────────────────────────────────────

// Represents an item in the gift
export interface IGiftItem {
  id: string;
  count: number;
}

// Represents a creature in the gift
export interface IGiftCreature {
  id: string;
  level: number;
  shiny?: boolean;
  form?: number;
  gender?: number;
  nature?: number;
  ability?: number | string;
  loyalty?: number;
  stats?: number[];
  bonus?: number[];
  moves?: string[];
  item?: number | string;
  given_name?: string;
  captured_with?: number | string;
  captured_in?: number;
  trainer_name?: string;
  trainer_id?: number;
}

// Represents an egg in the gift (partial creature data)
export interface IGiftEgg
  extends
    Pick<IGiftCreature, 'id'>,
    Partial<
      Pick<
        IGiftCreature,
        | 'level'
        | 'shiny'
        | 'form'
        | 'gender'
        | 'nature'
        | 'ability'
        | 'stats'
        | 'bonus'
        | 'trainer_name'
        | 'trainer_id'
      >
    > {}

// ─── Main type ───────────────────────────────────────────────────────────────

/** 'code' = claimed via textual code; 'internet' = claimed from public list */
export type MysteryGiftDistrib = 'code' | 'internet';

export interface MysteryGiftData {
  _id: Types.ObjectId;
  giftId: string; // human-readable identifier, e.g., "gift-abc123"
  title: string;

  // Contents (combinable; all optional but at least one must exist)
  items?: IGiftItem[];
  creatures?: IGiftCreature[];
  eggs?: IGiftEgg[];

  // Distribution type
  type: MysteryGiftDistrib;
  code?: string; // required if type === 'code'

  // Access control
  claimedBy: string[]; // playerIds who have already claimed
  allowedClaimers: string[]; // empty = anyone; otherwise whitelist
  maxClaims: number; // -1 = unlimited

  // Validity
  alwaysAvailable: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
  rarity: number; // 0 = common … 3 = legendary (cosmetic)

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMysteryGift extends MysteryGiftData, Document {
  _id: Types.ObjectId;

  /** Checks if playerId can claim this gift, returns { canClaim, reason? } */
  canBeClaimed(playerId: string): { canClaim: boolean; reason?: string };
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const creatureSubSchema = {
  id: { type: String, required: true },
  level: { type: Number, required: true },
  shiny: { type: Boolean },
  form: { type: Number },
  gender: { type: Number },
  nature: { type: Number },
  ability: { type: Schema.Types.Mixed },
  loyalty: { type: Number },
  stats: { type: [Number] },
  bonus: { type: [Number] },
  moves: { type: [String] },
  item: { type: Schema.Types.Mixed },
  given_name: { type: String },
  captured_with: { type: Schema.Types.Mixed },
  captured_in: { type: Number },
  trainer_name: { type: String },
  trainer_id: { type: Number },
};

const eggSubSchema = {
  id: { type: String, required: true },
  level: { type: Number, default: 1 },
  shiny: { type: Boolean },
  form: { type: Number },
  gender: { type: Number },
  nature: { type: Number },
  ability: { type: Schema.Types.Mixed },
  stats: { type: [Number] },
  bonus: { type: [Number] },
  trainer_name: { type: String },
  trainer_id: { type: Number },
};

const MysteryGiftSchema = new Schema<IMysteryGift>(
  {
    giftId: {
      type: String,
      unique: true,
      default: () => `gift-${Math.random().toString(36).substring(2, 10)}`,
    },
    title: { type: String, required: true, trim: true },

    items: {
      type: [
        {
          id: { type: String, required: true },
          count: { type: Number, default: 1 },
        },
      ],
      default: [],
    },
    creatures: { type: [creatureSubSchema], default: [] },
    eggs: { type: [eggSubSchema], default: [] },

    type: { type: String, required: true, enum: ['code', 'internet'] },
    code: {
      type: String,
      uppercase: true,
      trim: true,
      // required only if type === 'code'
      required: function (this: IMysteryGift) {
        return this.type === 'code';
      },
      // unique only among code-type gifts — sparse so null/undefined internet gifts are ignored
      unique: true,
      sparse: true,
    },

    claimedBy: { type: [String], default: [] },
    allowedClaimers: { type: [String], default: [] },
    maxClaims: { type: Number, default: -1 },

    alwaysAvailable: { type: Boolean, default: false },
    validFrom: { type: Date, default: null },
    validTo: {
      type: Date,
      default: null,
      validate: {
        validator(this: IMysteryGift, v: Date) {
          return !this.validFrom || !v || v > this.validFrom;
        },
        message: 'validTo must be later than validFrom.',
      },
    },
    rarity: { type: Number, default: 0, min: 0, max: 3 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }, // createdAt & updatedAt
);

// Note: the unique sparse index on `code` is declared inline on the field above.

// ─── Pre-save hook ──────────────────────────────────────────────────────────

MysteryGiftSchema.pre('save', function (next) {
  // If alwaysAvailable, clear validity dates
  if (this.alwaysAvailable) {
    this.validFrom = null;
    this.validTo = null;
  }
  next();
});

// ─── Instance method ────────────────────────────────────────────────────────

MysteryGiftSchema.methods.canBeClaimed = function (playerId: string): {
  canClaim: boolean;
  reason?: string;
} {
  const now = new Date();

  if (!this.alwaysAvailable) {
    if (this.validFrom && now < this.validFrom)
      return { canClaim: false, reason: 'This gift is not yet available.' };
    if (this.validTo && now > this.validTo)
      return { canClaim: false, reason: 'This gift has expired.' };
  }

  if (this.claimedBy.includes(playerId))
    return { canClaim: false, reason: 'You have already claimed this gift.' };

  if (
    this.allowedClaimers.length > 0 &&
    !this.allowedClaimers.includes(playerId)
  )
    return {
      canClaim: false,
      reason: 'You are not allowed to claim this gift.',
    };

  if (this.maxClaims !== -1 && this.claimedBy.length >= this.maxClaims)
    return {
      canClaim: false,
      reason: 'This gift is no longer available (limit reached).',
    };

  return { canClaim: true };
};

// ─── Model ────────────────────────────────────────────────────────────────

export const MysteryGift = model<IMysteryGift>(
  'MysteryGift',
  MysteryGiftSchema,
);
