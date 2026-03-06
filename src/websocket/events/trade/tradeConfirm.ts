import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import {
  getSessionByPlayer,
  getPartner,
  setConfirm,
  bothSelected,
  removeSession,
} from '@logic/tradeSession';

const tradeConfirmHandler = createEventHandler(
  'tradeConfirm',
  async (_data, ws) => {
    const playerId = server.getClientId(ws);
    if (!playerId) {
      return { success: false, message: 'Player not found' };
    }

    const session = getSessionByPlayer(playerId);
    if (!session) {
      return { success: false, message: 'No active trade session' };
    }

    // Both must have selected before confirming
    if (!bothSelected(session)) {
      return { success: false, message: 'Both players must select a Pokemon first' };
    }

    const bothConfirmed = setConfirm(session, playerId);

    if (!bothConfirmed) {
      // Notify partner that this player confirmed
      const partnerId = getPartner(session, playerId);
      if (partnerId) {
        const partnerWs = server.getClientWebsocket(partnerId);
        if (partnerWs) {
          server.emit(partnerWs, 'tradePartnerConfirmed', {});
        }
      }
      return { success: true, message: 'Waiting for partner confirmation' };
    }

    // Both confirmed — execute the trade
    const wsA = server.getClientWebsocket(session.playerA);
    const wsB = server.getClientWebsocket(session.playerB);

    // Send each player the other's serialized Pokemon data
    if (wsA) {
      server.emit(wsA, 'tradeComplete', { data: session.selectedB });
    }
    if (wsB) {
      server.emit(wsB, 'tradeComplete', { data: session.selectedA });
    }

    removeSession(session);

    return { success: true, message: 'Trade completed' };
  }
);

export default tradeConfirmHandler;
