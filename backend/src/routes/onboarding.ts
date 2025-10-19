import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authRequired, type JwtPayload } from '../middlewares/auth';

export const onboarding = Router();

const OnboardingSchema = z.object({
  primary_identifier: z.enum(['email', 'phone', 'cpf']).optional(),
  erp_slug: z.string().optional(),
  erp_base_url: z.string().url().optional(),
  botconversa_api_key: z.string().uuid().optional(),
  evolution_instance_name: z.string().optional(),
  evolution_webhook_url: z.string().optional(),
  evolution_connected: z.boolean().optional(),
});

// Mascara UUID: mantém só os últimos 7 chars
function maskUuid(uuid: string | null): string | null {
  if (!uuid || uuid.length < 12) return uuid;
  return `••••-••••-••••-••••-${uuid.slice(-7)}`;
}

// POST /onboarding - parcial/idempotente
onboarding.post('/onboarding', authRequired, async (req, res, next) => {
  try {
    const user = (req as any).user as JwtPayload;
    const data = OnboardingSchema.parse(req.body);

    // monta SET dinâmico apenas com campos enviados
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.primary_identifier !== undefined) {
      fields.push(`primary_identifier = $${idx++}`);
      values.push(data.primary_identifier);
    }
    if (data.erp_slug !== undefined) {
      fields.push(`erp_slug = $${idx++}`);
      values.push(data.erp_slug);
    }
    if (data.erp_base_url !== undefined) {
      fields.push(`erp_base_url = $${idx++}`);
      values.push(data.erp_base_url);
    }
    if (data.botconversa_api_key !== undefined) {
      fields.push(`botconversa_api_key = $${idx++}`);
      values.push(data.botconversa_api_key);
    }
    if (data.evolution_instance_name !== undefined) {
      fields.push(`evolution_instance_name = $${idx++}`);
      values.push(data.evolution_instance_name);
    }
    if (data.evolution_webhook_url !== undefined) {
      fields.push(`evolution_webhook_url = $${idx++}`);
      values.push(data.evolution_webhook_url);
    }
    if (data.evolution_connected !== undefined) {
      fields.push(`evolution_connected = $${idx++}`);
      values.push(data.evolution_connected);
    }

    if (fields.length === 0) {
      return res.json({ ok: true });
    }

    fields.push(`updated_at = now()`);
    
    // Coleta nomes de colunas para INSERT
    const colNames = fields.map(f => f.split(' = ')[0]);
    values.push(user.org_id);

    // UPSERT
    const sql = `
      INSERT INTO org_settings (org_id, ${colNames.join(', ')}, created_at)
      VALUES ($${idx}, ${values.slice(0, -1).map((_, i) => `$${i + 1}`).join(', ')}, now())
      ON CONFLICT (org_id) 
      DO UPDATE SET ${fields.join(', ')}
    `;

    await pool.query(sql, values);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// GET /onboarding
onboarding.get('/onboarding', authRequired, async (req, res, next) => {
  try {
    const user = (req as any).user as JwtPayload;
    const sql = `
      SELECT 
        primary_identifier,
        erp_slug,
        erp_base_url,
        botconversa_api_key,
        evolution_instance_name,
        evolution_webhook_url,
        evolution_connected
      FROM org_settings
      WHERE org_id = $1
    `;
    const { rows } = await pool.query(sql, [user.org_id]);
    
    if (rows.length === 0) {
      return res.json({
        primary_identifier: null,
        erp_slug: null,
        erp_base_url: null,
        botconversa_api_key: null,
        evolution_instance_name: null,
        evolution_webhook_url: null,
        evolution_connected: false,
      });
    }

    const data = rows[0];
    // mascara a API-KEY
    data.botconversa_api_key = maskUuid(data.botconversa_api_key);
    
    res.json(data);
  } catch (e) {
    next(e);
  }
});
