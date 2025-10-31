import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import mime from 'mime';
import { putObject } from '../lib/storage';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const orgId = (req.headers['x-org-id'] as string) || 'public';

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'file required' });

    let buffer = file.buffer;
    let contentType = file.mimetype;
    let ext = mime.getExtension(contentType) || 'bin';

    // Otimiza imagens
    if (contentType.startsWith('image/')) {
      const img = sharp(buffer).rotate();
      const meta = await img.metadata();
      const width = Math.min(meta.width || 0, 1280) || 1280;
      buffer = await img.resize({ width, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      contentType = 'image/jpeg';
      ext = 'jpg';
    }

    const key = `${orgId}/sequences/${randomUUID()}.${ext}`;
    const url = await putObject({ key, body: buffer, contentType });

    return res.status(201).json({
        key,                  // <- use isto no front para salvar no passo
        url,                  // <- opcional (útil para preview imediato)
        contentType,
        size: buffer.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
});

export default router;
