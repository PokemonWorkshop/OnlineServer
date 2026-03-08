import { Router, sendJson, readBody } from '../router';
import { extractPlayer } from '../middleware';
import { bankService } from '../../services/BankService';

export function registerBankRoutes(router: Router): void {
  /**
   * GET /api/v1/bank/boxes
   * Returns all the player's PokeBank boxes.
   */
  router.get('/api/v1/bank/boxes', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    const boxes = await bankService.getBoxes(req.playerId!);
    sendJson(res, 200, boxes);
  });

  /**
   * POST /api/v1/bank/deposit
   * Deposits a creature into a box.
   * Body: { boxIndex: number, slotIndex: number, creature: object }
   */
  router.post('/api/v1/bank/deposit', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    let body: any;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    if (
      body.boxIndex === undefined ||
      body.slotIndex === undefined ||
      !body.creature
    ) {
      sendJson(res, 400, {
        error: 'boxIndex, slotIndex and creature are required',
      });
      return;
    }

    const result = await bankService.depositCreature(
      req.playerId!,
      Number(body.boxIndex),
      Number(body.slotIndex),
      body.creature,
    );
    sendJson(res, result.ok ? 200 : 400, result);
  });

  /**
   * POST /api/v1/bank/withdraw
   * Withdraws a creature from a box.
   * Body: { boxIndex: number, slotIndex: number }
   */
  router.post('/api/v1/bank/withdraw', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    let body: any;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    if (body.boxIndex === undefined || body.slotIndex === undefined) {
      sendJson(res, 400, { error: 'boxIndex and slotIndex are required' });
      return;
    }

    const result = await bankService.withdrawCreature(
      req.playerId!,
      Number(body.boxIndex),
      Number(body.slotIndex),
    );
    sendJson(res, result.ok ? 200 : 400, result);
  });
}
