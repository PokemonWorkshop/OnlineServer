import { EventHandlers } from '@src/types';
import friendRequestHandler from './friendRequest';
import friendAcceptHandler from './friendAccept';
import friendDeclineHandler from './friendDecline';
import friendRemoveHandler from './friendRemove';
import friendListHandler from './friendList';
import friendPendingHandler from './friendPending';

export const friendEvents: EventHandlers = {
  friendRequest: friendRequestHandler,
  friendAccept: friendAcceptHandler,
  friendDecline: friendDeclineHandler,
  friendRemove: friendRemoveHandler,
  friendList: friendListHandler,
  friendPending: friendPendingHandler,
};


