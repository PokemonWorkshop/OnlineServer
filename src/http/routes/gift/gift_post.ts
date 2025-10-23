import { Gift } from '@root/src/models/gift/gift.model';
import { registerRoute } from '../../logic/routes';

// CREATE gift
registerRoute('POST', '/api/gift', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const gift = new Gift(body);
    await gift.save();

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, gift }));
  } catch (err) {
    console.error('Error creating gift:', err);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Invalid gift data' }));
  }
});


