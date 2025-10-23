import { registerRoute } from '../../logic/routes';
import { server } from '@root/src/index';

// STATUS route
registerRoute('GET', '/api/status', async (_, res) => {
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
});


