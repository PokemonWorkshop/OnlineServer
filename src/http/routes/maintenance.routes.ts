import { Router, sendJson, sendErrorResponse, readBody } from '../router';
import { requireAdmin } from '../middleware';
import { maintenanceService } from '../../services/MaintenanceService';
import { ErrorCode, createErrorResponse } from '../ErrorCode';
import { z } from 'zod';

const UpdateMaintenanceSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(500).optional(),
    endAt: z.union([z.iso.datetime(), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.enabled && (!data.message || data.message.trim() === '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['message'],
        message:
          'A maintenance message is required when maintenance is enabled',
      });
    }
  });

export function registerMaintenanceRoutes(router: Router): void {
  router.get('/api/v1/maintenance', async (_req, res) => {
    const status = await maintenanceService.getStatus();
    sendJson(res, 200, status);
  });

  router.patch('/api/v1/maintenance/admin', async (req, res) => {
    if (!requireAdmin(req, res)) return;

    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      sendErrorResponse(
        res,
        createErrorResponse(ErrorCode.INVALID_JSON, 'Invalid request body'),
      );
      return;
    }

    const parsed = UpdateMaintenanceSchema.safeParse(body);
    if (!parsed.success) {
      sendErrorResponse(
        res,
        createErrorResponse(
          ErrorCode.INVALID_DATA,
          'Invalid data',
          z.treeifyError(parsed.error),
        ),
      );
      return;
    }

    const endAt =
      parsed.data.endAt === null || parsed.data.endAt === undefined
        ? parsed.data.endAt
        : new Date(parsed.data.endAt);

    const status = await maintenanceService.update({
      enabled: parsed.data.enabled,
      message: parsed.data.message,
      endAt,
    });

    sendJson(res, 200, status);
  });

  router.delete('/api/v1/maintenance/admin', async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const status = await maintenanceService.disable();
    sendJson(res, 200, status);
  });
}
