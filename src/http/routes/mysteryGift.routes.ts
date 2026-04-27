import { Router, sendJson, readBody } from '../router';
import { extractPlayer, requireAdmin } from '../middleware';
import { mysteryGiftService } from '../../services/MysteryGiftService';
import { z } from 'zod';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const ItemSchema = z.object({
  id: z.string().min(1),
  count: z.number().int().positive().default(1),
});

const CreatureSchema = z.object({
  id: z.string().min(1),
  level: z.number().int().min(1).max(100),
  shiny: z.boolean().optional(),
  form: z.number().int().optional(),
  gender: z.number().int().optional(),
  nature: z.number().int().optional(),
  ability: z.union([z.number(), z.string()]).optional(),
  loyalty: z.number().int().optional(),
  stats: z.array(z.number()).optional(),
  bonus: z.array(z.number()).optional(),
  moves: z.array(z.string()).optional(),
  item: z.union([z.number(), z.string()]).optional(),
  given_name: z.string().optional(),
  captured_with: z.union([z.number(), z.string()]).optional(),
  captured_in: z.number().int().optional(),
  trainer_name: z.string().optional(),
  trainer_id: z.number().int().optional(),
});

const EggSchema = z.object({
  id: z.string().min(1),
  level: z.number().int().min(1).default(1),
  shiny: z.boolean().optional(),
  form: z.number().int().optional(),
  gender: z.number().int().optional(),
  nature: z.number().int().optional(),
  ability: z.union([z.number(), z.string()]).optional(),
  stats: z.array(z.number()).optional(),
  bonus: z.array(z.number()).optional(),
  trainer_name: z.string().optional(),
  trainer_id: z.number().int().optional(),
});

const CreateGiftSchema = z
  .object({
    title: z.string().min(1).max(64).trim(),
    type: z.enum(['code', 'internet']),

    // Content — at least one must be filled (checked below)
    items: z.array(ItemSchema).optional().default([]),
    creatures: z.array(CreatureSchema).optional().default([]),
    eggs: z.array(EggSchema).optional().default([]),

    // Distribution
    code: z.string().min(1).max(32).trim().optional(),
    allowedClaimers: z.array(z.string()).optional().default([]),
    maxClaims: z.number().int().min(-1).optional().default(-1),

    // Validity
    alwaysAvailable: z.boolean().optional().default(false),
    validFrom: z.iso.datetime().optional(),
    validTo: z.iso.datetime().optional(),
    rarity: z.number().int().min(0).max(3).optional().default(0),
  })
  .refine((d) => d.type !== 'code' || !!d.code, {
    message: 'code is required for a "code" type gift',
    path: ['code'],
  })
  .refine(
    (d) =>
      (d.items?.length ?? 0) +
        (d.creatures?.length ?? 0) +
        (d.eggs?.length ?? 0) >
      0,
    { message: 'The gift must contain at least one item, creature, or egg.' },
  );

const ClaimSchema = z
  .object({
    code: z.string().optional(),
    giftId: z.string().optional(),
  })
  .refine((d) => !!d.code || !!d.giftId, {
    message: 'Provide either a code (code type) or a giftId (internet type).',
  });

// ─── Routes ───────────────────────────────────────────────────────────────────

export function registerMysteryGiftRoutes(router: Router): void {
  /**
   * GET /api/v1/mystery-gift
   * Lists internet gifts available for the connected player.
   * Required header: x-player-id
   */
  router.get('/api/v1/mystery-gift', async (req, res) => {
    if (!extractPlayer(req, res)) return;
    const gifts = await mysteryGiftService.listForPlayer(req.playerId!);
    sendJson(res, 200, gifts);
  });

  /**
   * POST /api/v1/mystery-gift/claim
   * Claims a gift using a code or giftId.
   * Required header: x-player-id
   * Body: { code?: string } | { giftId?: string }
   */
  router.post('/api/v1/mystery-gift/claim', async (req, res) => {
    if (!extractPlayer(req, res)) return;

    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    const parsed = ClaimSchema.safeParse(body);
    if (!parsed.success) {
      sendJson(res, 400, {
        error: 'Invalid data',
        details: z.treeifyError(parsed.error),
      });
      return;
    }

    const result = await mysteryGiftService.claim(req.playerId!, parsed.data);
    sendJson(res, result.ok ? 200 : 400, result);
  });

  /**
   * POST /api/v1/mystery-gift/admin/create
   * Creates a gift (admin only, protected by global API Key).
   */
  router.post('/api/v1/mystery-gift/admin/create', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    const parsed = CreateGiftSchema.safeParse(body);
    if (!parsed.success) {
      sendJson(res, 400, {
        error: 'Invalid data',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { validFrom, validTo, ...rest } = parsed.data;
    try {
      const gift = await mysteryGiftService.create({
        ...rest,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validTo: validTo ? new Date(validTo) : undefined,
      });
      sendJson(res, 201, gift);
    } catch (err) {
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : 'Creation error',
      });
    }
  });

  /**
   * DELETE /api/v1/mystery-gift/admin/:giftId
   * Deactivates a gift (soft delete).
   */
  router.delete(
    '/api/v1/mystery-gift/admin/:giftId',
    async (req, res, params) => {
      if (!requireAdmin(req, res)) return;
      const result = await mysteryGiftService.deactivate(params.giftId);
      sendJson(res, result.ok ? 200 : 404, result);
    },
  );

  /**
   * POST /api/v1/mystery-gift/admin/purge
   * Permanently deletes expired gifts.
   */
  router.post('/api/v1/mystery-gift/admin/purge', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const deleted = await mysteryGiftService.purgeExpired();
    sendJson(res, 200, { deleted });
  });
}
