import { Gift } from '@root/src/models/gift/gift.model';
import { registerRoute } from '../../logic/routes';

// GET all gifts
registerRoute('GET', '/api/gifts', async (_, res) => {
  const gifts = await Gift.find();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(gifts));
});
