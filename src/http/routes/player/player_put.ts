import { Player } from '@root/src/models/player/player.model';
import { registerRoute } from '../../logic/routes';

// UPDATE player by ID
registerRoute('PUT', '/api/player/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const body = (req as any).body as Record<string, unknown>;
    const result = await Player.updateOne({ id: id }, body);
    if ((result as any).matchedCount === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Player not found' }));
      return;
    }
  } catch (err) {
    console.error('Error updating player:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Server error' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
});


