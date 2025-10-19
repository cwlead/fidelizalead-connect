import { Router } from 'express';
import { prisma } from '../prisma';
import { CreateTenantSchema, SaveBotConversaKeySchema } from '../schemas/tenants.schema';

export const tenants = Router();

tenants.post('/', async (req, res, next) => {
  try {
    const body = CreateTenantSchema.parse(req.body);
    const t = await prisma.tenant.create({ data: { name: body.name } });
    res.status(201).json(t);
  } catch (e) { next(e); }
});

tenants.put('/:tenantId/botconversa-key', async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { apiKey } = SaveBotConversaKeySchema.parse(req.body);
    const t = await prisma.tenant.update({
      where: { id: tenantId },
      data: { botconversaApiKey: apiKey }
    });
    res.json({ ok: true, tenantId: t.id });
  } catch (e) { next(e); }
});
