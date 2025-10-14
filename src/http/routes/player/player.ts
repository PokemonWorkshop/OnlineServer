import { Player } from '@root/src/models/player';
import { registerRoute } from '../../logic/routes';

// GET all players
registerRoute('GET', '/api/player', async (_, res) => {
  const players = await Player.find();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(players));
});

// GET player by ID
registerRoute('GET', '/api/player/:id', async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Player not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(player));
});
