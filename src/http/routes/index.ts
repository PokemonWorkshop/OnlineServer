import { server } from '@root/src';
import { Gift } from '@root/src/models/gift';
import { Player } from '@root/src/models/player';
import type { RouteMap } from '@root/src/types';

declare module 'http' {
  interface IncomingMessage {
    params: { [key: string]: string | undefined };
  }
}

const routes: RouteMap = {
  GET: {
    '/api/status': async (_, res) => {
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
    '/api/gift': async (_, res) => {
      try {
        const gifts = await Gift.find().lean();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, gifts }));
      } catch (err) {
        console.error('Error fetching gifts:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server error' }));
      }
    },
    '/api/gift/:id': async (req, res) => {
      const { id } = req.params;
      try {
        const gift = await Gift.findOne({ id: id }).lean();
        console.log(gift);
        if (!gift) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Gift not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, gift }));
      } catch (err) {
        console.error('Error fetching gift:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server error' }));
      }
    },
    '/api/player': async (req, res) => {
      try {
        const players = await Player.find().lean();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, players }));
      } catch (err) {
        console.error('Error fetching players:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server error' }));
      }
    },
    '/api/player/:id': async (req, res) => {
      const { id } = req.params;
      try {
        const player = await Player.findOne({ id: id }).lean();
        if (!player) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ success: false, error: 'Player not found' })
          );
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, player }));
      } catch (err) {
        console.error('Error fetching player:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server error' }));
      }
    },
  },
  POST: {
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
    '/api/gift/:id': async (req, res) => {
      const { id } = req.params;
      try {
        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(buffers).toString());

        const result = await Gift.updateOne({ id: id }, body);
        if (result.matchedCount === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Gift not found' }));
          return;
        }
      } catch (err) {
        console.error('Error updating gift:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server error' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    },
    '/api/player/:id': async (req, res) => {
      const { id } = req.params;
      try {
        const buffers: Buffer[] = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(buffers).toString());
        const result = await Player.updateOne({ id: id }, body);
        if (result.matchedCount === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ success: false, error: 'Player not found' })
          );
          return;
        }
      } catch (err) {
        console.error('Error updating player:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server error' }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    },
  },
  DELETE: {
    '/api/gift/:id': async (req, res) => {
      const { id } = req.params;
      try {
        const result = await Gift.deleteOne({ id: id });
        if (result.deletedCount === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Gift not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Error deleting gift:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server error' }));
      }
    },
    '/api/player/:id': async (req, res) => {
      const { id } = req.params;
      try {
        const result = await Player.deleteOne({ id: id });
        if (result.deletedCount === 0) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ success: false, error: 'Player not found' })
          );
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Error deleting player:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Server error' }));
      }
    },
  },
};

export default routes;
