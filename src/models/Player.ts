import { Document, model, Schema } from 'mongoose';

function generatedID(): string {
  const random = Math.random().toString(36).substring(2, 10);
  return random;
}

interface IPlayer extends Document {
  playerId: string;
  playerName: string;
  playingGirl?: boolean;
  charsetBase?: string;
  greeting?: string;
  isOnline: boolean;
  friendCode: string;
  friends: string[];
  lastConnection?: Date;
}

const PlayerSchema: Schema<IPlayer> = new Schema({
  playerId: {
    type: 'string',
    required: true,
    unique: true,
    minlength: 1,
  },
  playerName: {
    type: 'string',
    required: true,
    minlength: 1,
  },
  playingGirl: {
    type: 'boolean',
    required: true,
    default: false,
  },
  charsetBase: {
    type: 'string',
    default: '',
  },
  greeting: {
    type: 'string',
    default: '',
  },
  isOnline: {
    type: 'boolean',
    default: true,
  },
  friendCode: {
    type: 'string',
    required: true,
    unique: true,
    default: generatedID,
  },
  friends: {
    type: ['string'],
    default: [],
  },
  lastConnection: {
    type: 'date',
    default: Date.now,
  },
});

const Player = model<IPlayer>('players', PlayerSchema);

export { Player, IPlayer };
