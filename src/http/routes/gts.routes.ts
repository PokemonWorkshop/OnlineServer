import { Router, sendJson, readBody, getQuery } from '../router';
import { extractPlayer } from '../middleware';
import { gtsService } from '../../services/GtsService';

export function registerGtsRoutes(router: Router): void {
  /**
   * GET /api/v1/gts/deposit
   * Returns the player's active deposit, or null.
   */
  router.get('/api/v1/gts/deposit', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    const deposit = await gtsService.getMyDeposit(req.playerId!);
    sendJson(res, 200, deposit ?? null);
  });

  /**
   * POST /api/v1/gts/deposit
   * Deposits a creature on the GTS.
   * Body: { creature: object, wanted: { speciesId, minLevel?, maxLevel?, gender? } }
   */
  router.post('/api/v1/gts/deposit', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    let body: any;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    if (!body.creature || !body.wanted?.speciesId) {
      sendJson(res, 400, {
        error: 'creature and wanted.speciesId are required',
      });
      return;
    }

    const result = await gtsService.deposit(
      req.playerId!,
      body.creature,
      body.wanted,
    );
    sendJson(res, result.ok ? 201 : 400, result);
  });

  /**
   * GET /api/v1/gts/search?speciesId=&level=&gender=&page=
   * Searches for deposits compatible with what the player has to offer.
   */
  router.get('/api/v1/gts/search', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    const q = getQuery(req);
    const speciesId = q.get('speciesId');
    const level = parseInt(q.get('level') || '0');
    const gender = parseInt(q.get('gender') || '0');
    const page = parseInt(q.get('page') || '0');

    if (!speciesId || !level || !gender) {
      sendJson(res, 400, {
        error: 'Required parameters: speciesId, level, gender',
      });
      return;
    }

    const results = await gtsService.search(speciesId, level, gender, page);
    sendJson(res, 200, results);
  });

  /**
   * POST /api/v1/gts/trade/:depositId
   * Trades your creature for an existing GTS deposit.
   * Body: { offeredCreature: object }
   */
  router.post('/api/v1/gts/trade/:depositId', async (req, res, params) => {
    if (!extractPlayer(req, res)) return;
    let body: any;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    if (!body.offeredCreature) {
      sendJson(res, 400, { error: 'offeredCreature is required' });
      return;
    }

    const result = await gtsService.trade(
      req.playerId!,
      params.depositId,
      body.offeredCreature,
    );
    sendJson(res, result.ok ? 200 : 400, result);
  });

  /**
   * DELETE /api/v1/gts/deposit
   * Withdraws your own creature from the GTS.
   */
  router.delete('/api/v1/gts/deposit', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    const result = await gtsService.withdraw(req.playerId!);
    sendJson(res, result.ok ? 200 : 404, result);
  });
}
