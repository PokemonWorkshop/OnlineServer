import { EventHandlers } from '@src/types';
import playerCreateHandler from './playerCreate';
import playerDeleteHandler from './playerDelete';
import playerUpdateHandler from './playerUpdate';

export const playerEvents: EventHandlers = {
  playerCreate: playerCreateHandler,
  playerDelete: playerDeleteHandler,
  playerUpdate: playerUpdateHandler,
};


