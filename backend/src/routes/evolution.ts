import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env';
import {
  buildInstanceName,
  evoEnsureInstance,
  evoGetQrBase64,
  evoConnectionState,
} from '../services/evolution.service';
import { authRequired, type JwtPayload } from '../middlewares/auth';

export const evolution = Router();

const ConnectBody = z.object({
  seed: z.string().min(1).optional(),
  webhookUrl: z.string().url().optional(),
  // número opcional (E.164 sem "+", ex.: 5527999999999)
  number: z.string().regex(/^\d{10,15}$/).optional(),
});

/**
 * Conecta/garante a instância na Evolution e retorna state + QR (se disponível)
 * POST /evolution/connect
 */
evolution.post('/evolution/connect', authRequired, async (req, res, next) => {
  try {
    const { seed, webhookUrl, number } = ConnectBody.parse(req.body ?? {});
    const user = (req as any).user as JwtPayload | undefined;

    const baseSeed = seed ?? user?.org_id ?? user?.sub;
    if (!baseSeed) {
      return res.status(400).json({ error: 'Seed ausente (org_id/sub/seed)' });
    }

    const instance = buildInstanceName(String(baseSeed));
    const url = webhookUrl || env.EVOLUTION_DEFAULT_WEBHOOK_URL || '';

    // 1) criar/garantir instância (com number opcional)
    let ensure: any = null;
    try {
      ensure = await evoEnsureInstance(instance, url, number);
    } catch (err: any) {
      return res
        .status(502)
        .json({ ok: false, step: 'ensure', instance, error: err?.detail ?? String(err) });
    }

    // 2) checar estado
    let state: any = null;
    try {
      state = await evoConnectionState(instance);
    } catch (err: any) {
      return res
        .status(502)
        .json({ ok: false, step: 'state', instance, error: err?.detail ?? String(err) });
    }

    // 3) tentar QR (pode não existir ainda)
    let qrBase64: string | null = null;
    try {
      qrBase64 = await evoGetQrBase64(instance);
    } catch {
      qrBase64 = null;
    }

    return res.json({ ok: true, instance, ensure, state, qrBase64 });
  } catch (e) {
    next(e);
  }
});
