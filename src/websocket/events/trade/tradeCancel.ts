import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { getSessionByPlayer, getPartner, removeSession } from '@logic/tradeSession';

const tradeCancelHandler = createEventHandler(
  'tradeCancel',
  async (_data, ws) => {
    const playerId = server.getClientId(ws);
    if (!playerId) {
      return { success: false, message: 'Player not found' };
    }

    const session = getSessionByPlayer(playerId);
    if (!session) {
      return { success: false, message: 'No active trade session' };
    }

    // Notify partner
    const partnerId = getPartner(session, playerId);
    if (partnerId) {
      const partnerWs = server.getClientWebsocket(partnerId);
      if (partnerWs) {
        server.emit(partnerWs, 'tradeCancelled', {
          cancelledBy: playerId,
        });
      }
    }

    removeSession(session);

    return { success: true, message: 'Trade cancelled' };
  }
);

export default tradeCancelHandler;
