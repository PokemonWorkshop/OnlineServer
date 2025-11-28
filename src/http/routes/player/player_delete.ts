import { Player } from '@root/src/models/player/player.model';
import { registerRoute } from '../../logic/routes';

// DELETE player by ID
registerRoute('DELETE', '/api/player/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await Player.deleteOne({ id: id });
    if (result.deletedCount === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Player not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('Error deleting player:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Server error' }));
  }
});


