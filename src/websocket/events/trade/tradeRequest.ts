import { z } from 'zod';
import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Player } from '@root/src/models/player';
import {
  createTradeSession,
  getSessionByPlayer,
} from '@logic/tradeSession';

const TradeRequestData = z.object({
  friendId: z.string(),
});

const tradeRequestHandler = createEventHandler(
  'tradeRequest',
  async (data, ws) => {
    const validatedData = TradeRequestData.safeParse(data);
    if (!validatedData.success) {
      return { success: false, message: 'Invalid trade request data' };
    }

    const playerId = server.getClientId(ws);
    if (!playerId) {
      return { success: false, message: 'Player not found' };
    }

    const { friendId } = validatedData.data;

    console.log(`[tradeRequest] sender="${playerId}" target="${friendId}"`);
    console.log(`[tradeRequest] connected clients:`, server.clientsIds);

    // Check target is online
    const targetWs = server.getClientWebsocket(friendId);
    if (!targetWs) {
      console.log(`[tradeRequest] FAILED: target "${friendId}" not found in clients`);
      return { success: false, message: 'Player is not online' };
    }

    // Check neither player is already in a trade
    if (getSessionByPlayer(playerId)) {
      return { success: false, message: 'You are already in a trade session' };
    }
    if (getSessionByPlayer(friendId)) {
      return { success: false, message: 'Target player is already in a trade session' };
    }

    // Create session
    const session = createTradeSession(playerId, friendId);
    if (!session) {
      return { success: false, message: 'Failed to create trade session' };
    }

    // Get sender info for the push notification
    const senderData = await Player.findOne({ id: playerId });
    const senderName = senderData?.name || playerId;

    // Notify target (distinct event name to avoid collision with request response)
    console.log(`[tradeRequest] SUCCESS: pushing tradeRequestReceived to "${friendId}" (from="${senderName}")`);
    server.emit(targetWs, 'tradeRequestReceived', {
      fromId: playerId,
      fromName: senderName,
      sessionId: session.id,
    });

    return { success: true, message: 'Trade request sent' };
  }
);

export default tradeRequestHandler;
