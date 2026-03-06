import { z } from 'zod';
import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { getSessionByPlayer, getPartner, setSelection } from '@logic/tradeSession';

const TradeSelectData = z.object({
  preview: z.record(z.string(), z.unknown()),
  data: z.string(),
});

const tradeSelectHandler = createEventHandler(
  'tradeSelect',
  async (data, ws) => {
    const validatedData = TradeSelectData.safeParse(data);
    if (!validatedData.success) {
      return { success: false, message: 'Invalid trade select data' };
    }

    const playerId = server.getClientId(ws);
    if (!playerId) {
      return { success: false, message: 'Player not found' };
    }

    const session = getSessionByPlayer(playerId);
    if (!session) {
      return { success: false, message: 'No active trade session' };
    }

    // Store selection
    setSelection(session, playerId, validatedData.data.data, validatedData.data.preview);

    // Send preview (not serialized data) to partner
    const partnerId = getPartner(session, playerId);
    if (partnerId) {
      const partnerWs = server.getClientWebsocket(partnerId);
      if (partnerWs) {
        server.emit(partnerWs, 'tradePartnerSelected', {
          preview: validatedData.data.preview,
          data: validatedData.data.data,
        });
      }
    }

    return { success: true, message: 'Pokemon selected' };
  }
);

export default tradeSelectHandler;
