import { EventHandlers } from '@src/types';
import errorHandler from './error';
import { playerEvents } from './player';
import { friendEvents } from './friend';
import { giftEvents } from './gift';
import { gtsEvents } from './gts';

/**
 * An object containing event handlers for various websocket events.
 *
 * @type {EventHandlers}
 */
const events: EventHandlers = {
  error: errorHandler,
  ...playerEvents,
  ...friendEvents,
  ...giftEvents,
  ...gtsEvents,
};

export default events;
