import { Router } from 'express';
import { prisma } from '../prisma';
import { getSubscriberByPhone } from '../services/botconversa.service';

export const botconversa = Router();

botconversa.get('/:tenantId/subscriber/:phone', async (req, res, next) => {
  try {
    const { tenantId, phone } = req.params; // phone: 55DDDNXXXXXXXX (igual teu exemplo)
    const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!t?.botconversaApiKey) {
      return res.status(400).json({ error: 'Tenant sem BotConversa API-KEY salva' });
    }
    const data = await getSubscriberByPhone(t.botconversaApiKey, phone);
    res.json(data);
  } catch (e) { next(e); }
});
