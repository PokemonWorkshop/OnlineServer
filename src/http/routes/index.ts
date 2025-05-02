import { server } from '@root/src';
import { Gift } from '@root/src/models/gift';
import type { RouteMap } from '@root/src/types';

const routes: RouteMap = {
  GET: {
    '/api/status': async (req, res) => {
      const start = performance.now();

      const latency = performance.now() - start;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          playerOnline: server.clientsCount,
          APILatencyMs: latency.toFixed(2),
          WSSLatencyMs: server.getGlobalLatency()
            ? server.getGlobalLatency()!.toFixed(2)
            : null,
        })
      );
    },
    '/api/health': (req, res) => {},
  },
  POST: {
    '/api/login': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ online: true }));
    },
    '/api/logout': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ online: true }));
    },
    '/api/gift': async (req, res) => {
      try {
        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(buffers).toString());

        const gift = new Gift(body);
        await gift.save();

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, gift }));
      } catch (err) {
        console.error('Error creating gift:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid gift data' }));
      }
    },
  },
  PUT: {
    '/api/update': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ online: true }));
    },
  },
  DELETE: {
    '/api/delete': (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ online: true }));
    },
  },
};

export default routes;
