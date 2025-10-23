import { Gift } from '@root/src/models/gift/gift.model';
import { registerRoute } from '../../logic/routes';

// DELETE gift by ID
registerRoute('DELETE', '/api/gift/:id', async (req, res) => {
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
});


