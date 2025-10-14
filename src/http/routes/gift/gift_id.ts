import { registerRoute } from '../../logic/routes';
import { Gift } from '@root/src/models/gift';

// GET gift by ID
registerRoute('GET', '/api/gift/:id', async (req, res) => {
  const gift = await Gift.findById(req.params.id);
  if (!gift) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gift not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(gift));
});
