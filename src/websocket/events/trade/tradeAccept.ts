import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { getSessionByPlayer, getPartner } from '@logic/tradeSession';

const tradeAcceptHandler = createEventHandler(
  'tradeAccept',
  async (_data, ws) => {
    const playerId = server.getClientId(ws);
    if (!playerId) {
      return { success: false, message: 'Player not found' };
    }

    const session = getSessionByPlayer(playerId);
    if (!session) {
      return { success: false, message: 'No pending trade session' };
    }

    // Only playerB (the target) can accept
    if (session.playerB !== playerId) {
      return { success: false, message: 'Only the trade recipient can accept' };
    }

    // Notify the initiator
    const partnerWs = server.getClientWebsocket(session.playerA);
    if (partnerWs) {
      server.emit(partnerWs, 'tradeAccepted', { sessionId: session.id });
    }

    return { success: true, message: 'Trade accepted' };
  }
);

export default tradeAcceptHandler;
