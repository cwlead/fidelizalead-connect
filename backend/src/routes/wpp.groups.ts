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

    const q = await pool.query<{
      id: string;
      org_id: string;
      wa_group_id: string;
      contatos_sincronizados: Boolean;
      subject: string | null;
      picture_url: string | null;
    }>(
      `
        select
            id,
            org_id,
            wa_group_id,
            contatos_sincronizados,
            subject,
            picture_url
        from public.wpp_groups
        where org_id = $1
        order by subject asc nulls last, created_at desc
      `,
      [orgId]
    );

    return res.json(q.rows);
  } catch (err: any) {
    console.error('[GET /wpp/groups] error', err?.message || err);
    return res.status(502).json({ ok: false, error: 'groups_list_failed' });
  }
});

/**
 * POST /api/wpp/groups/:group_id/register-members
 * Dispara sincronização de contatos de grupo no N8N.
 * FRONT envia: { org_id, wa_group_id, subject, trigger }
 */
wppGroupsRouter.post(
  '/groups/:group_id/register-members',
  /* authRequired, */ async (req, res) => {
    try {
      const body = (req.body ?? {}) as any;
      const groupId = (req.params.group_id || '').trim();
      if (!groupId)
        return res.status(400).json({ ok: false, error: 'missing_group_id' });

      const user = (req as any).user as { org_id?: string; sub?: string } | undefined;
      let orgId: string | undefined = user?.org_id || body?.org_id || body?.orgId;

      if (!orgId) {
        const orgQ = await pool.query<{ org_id: string }>(
          `select org_id from public.wpp_groups where id = $1 limit 1`,
          [groupId]
        );
        orgId = orgQ.rows[0]?.org_id;
      }
      if (!orgId)
        return res.status(400).json({ ok: false, error: 'missing_org_id' });

      // --- 🔒 Proteção contra flood (cooldown) ---
      const cooldownSec = 50; // 3 minutos
      const { rows } = await pool.query(
        `select last_sync_requested_at_wpp_group from org_settings where org_id = $1 limit 1`,
        [orgId]
      );
      const lastSync = rows[0]?.last_sync_requested_at_wpp_group
        ? new Date(rows[0].last_sync_requested_at_wpp_group)
        : null;

      if (
        lastSync &&
        Date.now() - lastSync.getTime() < cooldownSec * 1000
      ) {
        const waitSec = Math.ceil(
          cooldownSec - (Date.now() - lastSync.getTime()) / 1000
        );
        return res.status(429).json({
          ok: false,
          error: 'Aguarde 30 segundos antes de sincronizar novamente.',
          message: `Aguarde ${waitSec} segundos antes de sincronizar novamente.`,
        });
      }

      // Atualiza timestamp de última tentativa
      await pool.query(
        `
          update org_settings
             set last_sync_requested_at_wpp_group = now(),
                 updated_at = now()
           where org_id = $1
        `,
        [orgId]
      );

      // --- 🔄 Carrega grupo ---
      const gQ = await pool.query<{
        id: string;
        org_id: string;
        wa_group_id: string;
        subject: string | null;
        picture_url: string | null;
        created_at: string;
      }>(
        `select id, org_id, wa_group_id, subject, picture_url, created_at
           from public.wpp_groups
          where id = $1 and org_id = $2
          limit 1`,
        [groupId, orgId]
      );
      if (gQ.rowCount === 0) {
        return res
          .status(404)
          .json({ ok: false, error: 'group_not_found_or_not_owned' });
      }
      const group = gQ.rows[0];

      const subjectFromBody: string | null = body?.subject ?? null;
      const finalSubject = group.subject ?? subjectFromBody ?? null;

      // --- 🔗 Chama N8N ---
      const N8N_WEBHOOK_URL = process.env.N8N_SINCRONIZAR_CONTATOS;
      if (!N8N_WEBHOOK_URL) {
        return res
          .status(500)
          .json({ ok: false, error: 'missing_env_N8N_SINCRONIZAR_CONTATOS' });
      }

      const payload = {
        org_id: orgId,
        group_id: group.id,
        wa_group_id: group.wa_group_id,
        subject: finalSubject,
        group: {
          id: group.id,
          org_id: group.org_id,
          wa_group_id: group.wa_group_id,
          subject: finalSubject,
          picture_url: group.picture_url,
          created_at: group.created_at,
        },
        trigger: body?.trigger ?? 'register_group_contacts',
        ts: new Date().toISOString(),
      };

      await axios.post(N8N_WEBHOOK_URL, payload, { timeout: 30_000 });

      return res.json({
        ok: true,
        message: 'Sincronização iniciada com sucesso.',
      });
    } catch (err: any) {
      console.error(
        '[POST /wpp/groups/:id/register-members] error',
        err?.response?.data ?? err?.message ?? err
      );
      return res
        .status(502)
        .json({ ok: false, error: 'register_members_failed' });
    }
  }
);
