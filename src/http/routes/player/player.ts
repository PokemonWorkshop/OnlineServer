import { Player } from '@root/src/models/player/player.model';
import { registerRoute } from '../../logic/routes';

// GET all players
registerRoute('GET', '/api/player', async (_, res) => {
  try {
    const players = await Player.find().lean();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, players }));
  } catch (err) {
    console.error('Error fetching players:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Server error' }));
  }
});

// GET player by ID
registerRoute('GET', '/api/player/:id', async (req, res) => {
  try {
    const player = await Player.findOne({ id: req.params.id }).lean();
    if (!player) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Player not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, player }));
  } catch (err) {
    console.error('Error fetching player:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Server error' }));
  }
});
