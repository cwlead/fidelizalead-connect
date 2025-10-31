import { Router, type Request, type Response } from 'express';
import { getObject } from '../lib/storage';

const router = Router();

// aceita barras no parâmetro (/:key(*))
router.get('/:key(*)', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    if (!key) return res.status(400).json({ error: 'key required' });

    const obj = await getObject(key);
    res.setHeader('Content-Type', obj.contentType);
    if (obj.contentLength) res.setHeader('Content-Length', String(obj.contentLength));
    obj.stream.pipe(res);
  } catch (err: any) {
    res.status(404).json({ error: 'not_found' });
  }
});

export default router;
