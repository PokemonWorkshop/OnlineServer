import { EventHandlers } from '@src/types';
import giftListHandler from './giftList';
import giftClaimHandler from './giftClaim';
import giftClaimByCodeHandler from './giftClaimByCode';
import giftClaimByIdHandler from './giftClaimById';

export const giftEvents: EventHandlers = {
  giftList: giftListHandler,
  giftClaim: giftClaimHandler,
  giftClaimByCode: giftClaimByCodeHandler,
  giftClaimById: giftClaimByIdHandler,
};


