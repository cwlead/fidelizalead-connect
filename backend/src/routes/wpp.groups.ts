// src/routes/wpp.groups.ts
import { Router } from 'express';
import axios from 'axios';
import { pool } from '../db';
import { authRequired, type JwtPayload } from '../middlewares/auth';

export const wppGroupsRouter = Router();

/**
 * GET /api/wpp/groups?org_id=...
 * Lista grupos da organização.
 */
wppGroupsRouter.get('/groups', authRequired, async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload | undefined;
    const orgIdFromJwt = user?.org_id as string | undefined;
    const orgIdFromQuery = (req.query.org_id as string | undefined)?.trim();
    const orgId = orgIdFromJwt || orgIdFromQuery;

    if (!orgId) {
      return res.status(400).json({ ok: false, error: 'missing_org_id' });
    }

    // Ajuste os campos conforme seu schema real:
    const q = await pool.query<{
      id: string;
      org_id: string;
      wa_group_id: string;
      subject: string | null;
      picture_url: string | null; // se não existir, mapeamos para null
    }>(
      `
        select
            id,
            org_id,
            wa_group_id,
            subject,
            picture_url               -- << AQUI: use a coluna real
        from public.wpp_groups
        where org_id = $1
        order by subject asc nulls last, created_at desc
        `, [orgId]);

    return res.json(q.rows);
  } catch (err: any) {
    console.error('[GET /wpp/groups] error', err?.message || err);
    return res.status(502).json({ ok: false, error: 'groups_list_failed' });
  }
});

/**
 * POST /api/wpp/groups/:group_id/register-members
 * FRONT envia: { org_id, wa_group_id, subject, trigger }
 */
wppGroupsRouter.post('/groups/:group_id/register-members', /* authRequired, */ async (req, res) => {
  try {
    // TEMP: debug — remova depois de confirmar
    console.log('[register-members] body:', req.body);

    const groupId = (req.params.group_id || '').trim();
    if (!groupId) return res.status(400).json({ ok: false, error: 'missing_group_id' });

    // 1) Tentar org_id do JWT (se tiver auth), do body (org_id/orgId) e, se preciso, do banco via group_id
    const user = (req as any).user as { org_id?: string; sub?: string } | undefined;
    let orgId: string | undefined =
      (user?.org_id as string | undefined)
      || (req.body?.org_id as string | undefined)
      || (req.body?.orgId as string | undefined);

    if (!orgId) {
      const orgQ = await pool.query<{ org_id: string }>(
        `select org_id from public.wpp_groups where id = $1 limit 1`,
        [groupId]
      );
      orgId = orgQ.rows[0]?.org_id;
    }

    if (!orgId) return res.status(400).json({ ok: false, error: 'missing_org_id' });

    const wa_group_id: string | undefined = req.body?.wa_group_id ?? req.body?.waGroupId;
    const subject: string | null = (req.body?.subject ?? null);
    const trigger: string = (req.body?.trigger ?? 'register_group_contacts');

    // 2) Garantir que o grupo pertence à org
    const ownerQ = await pool.query(
      `select 1 from public.wpp_groups where id = $1 and org_id = $2 limit 1`,
      [groupId, orgId]
    );
    if (ownerQ.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'group_not_found_or_not_owned' });
    }

    // 3) Webhook N8N pela ENV (como você setou)
    const N8N_WEBHOOK_URL = process.env.N8N_SINCRONIZAR_CONTATOS;
    if (!N8N_WEBHOOK_URL) {
      return res.status(500).json({ ok: false, error: 'missing_env_N8N_SINCRONIZAR_CONTATOS' });
    }

    await axios.post(N8N_WEBHOOK_URL, {
      org_id: orgId,
      group_id: groupId,
      wa_group_id: wa_group_id ?? null,
      subject,
      trigger,
      ts: new Date().toISOString()
    });

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[POST /wpp/groups/:id/register-members] error', err?.response?.data ?? err?.message ?? err);
    return res.status(502).json({ ok: false, error: 'register_members_failed' });
  }
});