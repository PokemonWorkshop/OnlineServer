import { EventHandlers } from '@src/types';
import errorHandler from './error';
import playerCreateHandler from './player/playerCreate';
import playerDeleteHandler from './player/playerDelete';
import giftListHandler from './gift/giftList';
import gtsAddHandler from './gts/gtsAdd';
import gtsTradeHandler from './gts/gtsTrade';
import gtsAllListHandler from './gts/gtsAllList';
import friendRequestHandler from './friend/friendRequest';
import friendAcceptHandler from './friend/friendAccept';
import friendDeclineHandler from './friend/friendDecline';
import friendRemoveHandler from './friend/friendRemove';
import friendListHandler from './friend/friendList';
import friendPendingHandler from './friend/friendPending';
import giftClaimHandler from './gift/giftClaim';
import giftClaimByCodeHandler from './gift/giftClaimByCode';
import giftClaimByIdHandler from './gift/giftClaimById';
import playerUpdateHandler from './player/playerUpdate';

/**
 * An object containing event handlers for various websocket events.
 *
 * @type {EventHandlers}
 */
const events: EventHandlers = {
  error: errorHandler,
  playerCreate: playerCreateHandler,
  playerDelete: playerDeleteHandler,
  playerUpdate: playerUpdateHandler,
  giftClaim: giftClaimHandler,
  giftList: giftListHandler,
  giftClaimByCode: giftClaimByCodeHandler,
  giftClaimById: giftClaimByIdHandler,
  gtsAdd: gtsAddHandler,
  gtsTrade: gtsTradeHandler,
  gtsAllList: gtsAllListHandler,
  friendRequest: friendRequestHandler,
  friendAccept: friendAcceptHandler,
  friendDecline: friendDeclineHandler,
  friendRemove: friendRemoveHandler,
  friendList: friendListHandler,
  friendPending: friendPendingHandler,
};

export default events;
