import { Router, sendJson, sendServiceResponse } from '../router';
import { extractPlayer } from '../middleware';
import { friendService } from '../../services/FriendService';
import { ErrorCode } from '../ErrorCode';

export function registerFriendRoutes(router: Router): void {
  /**
   * GET /api/v1/friends
   * Returns the player's friends list + pending requests.
   * PSDK clients call this route using polling (~every 30s).
   */
  router.get('/api/v1/friends', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    const data = await friendService.getList(req.playerId!);
    if (!data) {
      ErrorCode.PLAYER_NOT_REGISTERED;
      sendJson(res, 404, {
        ok: false,
        code: 'PLAYER_NOT_REGISTERED',
        error: 'Player not registered',
      });
      return;
    }
    sendJson(res, 200, data);
  });

  /**
   * POST /api/v1/friends/heartbeat
   * Updates the player's lastSeen to indicate they are online.
   * Should be called every ~30s on the PSDK side.
   * A player is considered "online" if lastSeen < 60s.
   */
  router.post('/api/v1/friends/heartbeat', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    await friendService.heartbeat(req.playerId!);
    sendJson(res, 200, { ok: true });
  });

  /**
   * POST /api/v1/friends/request/:friendCode
   * Sends a friend request to the player identified by their friend code.
   */
  router.post(
    '/api/v1/friends/request/:friendCode',
    async (req, res, params) => {
      if (!extractPlayer(req, res)) return;
      const result = await friendService.sendRequest(
        req.playerId!,
        params.friendCode,
      );
      sendServiceResponse(res, result);
    },
  );

  /**
   * POST /api/v1/friends/accept/:friendCode
   * Accepts a received friend request.
   */
  router.post(
    '/api/v1/friends/accept/:friendCode',
    async (req, res, params) => {
      if (!extractPlayer(req, res)) return;
      const result = await friendService.acceptRequest(
        req.playerId!,
        params.friendCode,
      );
      sendServiceResponse(res, result);
    },
  );

  /**
   * POST /api/v1/friends/decline/:friendCode
   * Declines a received friend request.
   */
  router.post(
    '/api/v1/friends/decline/:friendCode',
    async (req, res, params) => {
      if (!extractPlayer(req, res)) return;
      const result = await friendService.declineRequest(
        req.playerId!,
        params.friendCode,
      );
      sendJson(res, 200, result);
    },
  );

  /**
   * DELETE /api/v1/friends/:friendCode
   * Removes a friend from the list (from both sides).
   */
  router.delete('/api/v1/friends/:friendCode', async (req, res, params) => {
    if (!extractPlayer(req, res)) return;
    const result = await friendService.removeFriend(
      req.playerId!,
      params.friendCode,
    );
    sendServiceResponse(res, result);
  });
}
