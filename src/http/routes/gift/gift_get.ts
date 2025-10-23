import { Gift } from '@root/src/models/gift/gift.model';
import { registerRoute } from '../../logic/routes';

// GET all gifts
registerRoute('GET', '/api/gift', async (_, res) => {
  try {
    const gifts = await Gift.find().lean();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, gifts }));
  } catch (err) {
    console.error('Error fetching gifts:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Server error' }));
  }
});

// GET gift by ID
registerRoute('GET', '/api/gift/:id', async (req, res) => {
  try {
    const gift = await Gift.findOne({ id: req.params.id }).lean();
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
});


