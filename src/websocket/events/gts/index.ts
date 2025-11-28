import { EventHandlers } from '@src/types';
import gtsAddHandler from './gtsAdd';
import gtsTradeHandler from './gtsTrade';
import gtsAllListHandler from './gtsAllList';
import gtsRemoveHandler from './gtsRemove';

export const gtsEvents: EventHandlers = {
  gtsAdd: gtsAddHandler,
  gtsTrade: gtsTradeHandler,
  gtsAllList: gtsAllListHandler,
  gtsRemove: gtsRemoveHandler,
};


