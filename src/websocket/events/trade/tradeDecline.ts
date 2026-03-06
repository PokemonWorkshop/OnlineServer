import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { getSessionByPlayer, getPartner, removeSession } from '@logic/tradeSession';

const tradeDeclineHandler = createEventHandler(
  'tradeDecline',
  async (_data, ws) => {
    const playerId = server.getClientId(ws);
    if (!playerId) {
      return { success: false, message: 'Player not found' };
    }

    const session = getSessionByPlayer(playerId);
    if (!session) {
      return { success: false, message: 'No pending trade session' };
    }

    // Notify the partner (initiator)
    const partnerId = getPartner(session, playerId);
    if (partnerId) {
      const partnerWs = server.getClientWebsocket(partnerId);
      if (partnerWs) {
        server.emit(partnerWs, 'tradeDeclined', { sessionId: session.id });
      }
    }

    removeSession(session);

    return { success: true, message: 'Trade declined' };
  }
);

export default tradeDeclineHandler;
