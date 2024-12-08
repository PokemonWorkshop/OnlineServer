import { Document, model, Schema } from 'mongoose';

function generatedID(): string {
  const random = Math.random().toString(36).substring(2, 10);
  return `gift-${random}`;
}

interface IItems {
  id: string;
  count: number;
}

interface ICreatures {
  id: string;
  level: number;
  shiny?: boolean;
  form?: number;
  given_name?: string;
  captured_with?: number | string;
  captured_in?: number;
  egg_in?: number;
  egg_at?: Date;
  gender?: number;
  nature?: number;
  stats?: number[];
  bonus?: number[];
  item?: number | string;
  ability?: number | string;
  loyalty?: number;
  moves?: string[];
  trainer_name?: string;
  trainer_id?: number;
}

interface IGift extends Document {
  giftId: string;
  items?: IItems[];
  creatures?: ICreatures[];
  availability?: {
    startDate?: Date;
    endDate: Date;
  };
  title: string;
  claimedBy: string[];
  redeemType: 'code' | 'internet';
  redeemCode?: string;
  alwaysAvailable: boolean;
  isActive: boolean;
}

const GiftSchema: Schema<IGift> = new Schema(
  {
    giftId: {
      type: 'string',
      required: true,
      unique: true,
      default: generatedID,
    },
    items: [
      {
        id: { type: 'string', required: true },
        count: { type: 'number', default: 1 },
      },
    ],
    creatures: [
      {
        id: { type: 'string', required: true },
        level: { type: 'number', required: true },
        shiny: { type: 'boolean' },
        form: { type: 'number' },
        given_name: { type: 'string' },
        captured_with: { type: Schema.Types.Mixed },
        captured_in: { type: 'number' },
        egg_in: { type: 'number' },
        egg_at: { type: 'date' },
        gender: { type: 'number' },
        nature: { type: 'number' },
        stats: { type: ['number'] },
        bonus: { type: ['number'] },
        item: { type: Schema.Types.Mixed },
        ability: { type: Schema.Types.Mixed },
        loyalty: { type: 'number' },
        moves: { type: ['string'] },
        trainer_name: { type: 'string' },
        trainer_id: { type: 'number' },
      },
    ],
    availability: {
      startDate: {
        type: 'date',
        required: function () {
          return !this.alwaysAvailable;
        },
      },
      endDate: {
        type: 'date',
        required: function () {
          return !this.alwaysAvailable;
        },
      },
    },
    title: { type: 'string', required: true },
    claimedBy: { type: ['string'], default: [] },
    redeemType: { type: 'string', required: true, enum: ['code', 'internet'] },
    redeemCode: {
      type: 'string',
      required: function () {
        return this.redeemType === 'code';
      },
    },
    alwaysAvailable: { type: 'boolean', default: false },
    isActive: { type: 'boolean', default: true },
  },
  { strict: false }
);

GiftSchema.path('availability.startDate').validate(function (value) {
  if (this.availability && this.availability.endDate) {
    return new Date(value) <= new Date(this.availability.endDate);
  }
  return true;
}, 'The start date must be earlier than the end date');

GiftSchema.path('availability.endDate').validate(function (value) {
  if (this.availability && this.availability.startDate) {
    return new Date(value) >= new Date(this.availability.startDate);
  }
  return true;
}, 'The end date must be later than the start date');

const Gift = model<IGift>('gifts', GiftSchema);

export { Gift, IGift };
