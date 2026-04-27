import fs from 'node:fs';
import path from 'node:path';
import { Router, sendJson } from '../router';
import { requireAdmin } from '../middleware';
import { telemetry } from '../../telemetry/store';
import { clients } from '../../ws/WsServer';
import { TelemetrySnapshot } from '../../models/TelemetrySnapshot';
import { AuthenticatedWs } from '../../ws/types';

const DASHBOARD_HTML = path.join(__dirname, '../../telemetry/dashboard.html');

export function registerTelemetryRoutes(router: Router): void {
  // ── Dashboard HTML (direct browser access) ──────────────────────────
  // Note: this route bypasses the apiKey middleware — it is accessible
  // without a header (the JS page asks for the key via prompt).
  router.get('/telemetry', async (_req, res) => {
    try {
      const html = fs.readFileSync(DASHBOARD_HTML, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      sendJson(res, 500, { error: 'Dashboard HTML not found' });
    }
  });

  // ── Global summary ───────────────────────────────────────────────────
  router.get('/telemetry/summary', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, telemetry.getSummary());
  });

  // ── Stats by HTTP route ─────────────────────────────────────────────
  router.get('/telemetry/routes', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, telemetry.getRouteStatsArray());
  });

  // ── Stats by WS message type ────────────────────────────────────────
  router.get('/telemetry/ws-types', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, telemetry.getWsTypeStatsArray());
  });

  // ── Currently connected WS clients ──────────────────────────────────
  router.get('/telemetry/ws-clients', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const list = Array.from(clients.values()).map((ws: AuthenticatedWs) => ({
      playerId: ws.playerId,
      trainerName: ws.trainerName,
    }));
    sendJson(res, 200, list);
  });

  // ── Recent events (ring buffer) ─────────────────────────────────────
  router.get('/telemetry/events', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const url = new URL(req.url || '/', 'http://localhost');
    const limit = Math.min(
      200,
      parseInt(url.searchParams.get('limit') || '50', 10),
    );
    sendJson(res, 200, telemetry.getRecentEvents(limit));
  });

  // ── Hourly snapshots (memory + MongoDB for the last 7 days) ─────────
  router.get('/telemetry/snapshots', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    // Memory = current 24h, Mongo = full 7-day history
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const dbSnaps = await TelemetrySnapshot.find({ hour: { $gte: since } })
      .sort({ hour: 1 })
      .lean<
        {
          hour: Date;
          httpCount: number;
          httpErrors: number;
          wsMessages: number;
          wsConnects: number;
          dbQueries: number;
          dbErrors: number;
          avgLatencyMs: number;
        }[]
      >();

    // Merge Mongo + memory (memory is fresher)
    const memSnaps = telemetry.getSnapshots();
    const memHours = new Set(memSnaps.map((s) => s.hour));

    const merged = [
      ...dbSnaps
        .filter((d) => !memHours.has(d.hour.getTime()))
        .map((d) => ({
          hour: d.hour.getTime(),
          httpCount: d.httpCount,
          httpErrors: d.httpErrors,
          wsMessages: d.wsMessages,
          wsConnects: d.wsConnects,
          dbQueries: d.dbQueries,
          dbErrors: d.dbErrors,
          avgLatencyMs: d.avgLatencyMs,
        })),
      ...memSnaps,
    ].sort((a, b) => a.hour - b.hour);

    sendJson(res, 200, merged);
  });
}
